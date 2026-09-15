import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AskChatBody,
  AskChatResponse,
  SearchDocumentsBody,
  SearchDocumentsResponse,
} from "@workspace/api-zod";
import {
  conversationsTable,
  db,
  messagesTable,
} from "@workspace/db";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/requireAuth";
import { createEmbedding, generateGroundedAnswer } from "../lib/ai";
import { searchChunks } from "../lib/documents";

const router: IRouter = Router();
router.use(requireAuth);

router.post("/search", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const parsed = SearchDocumentsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search query" });
    return;
  }
  const embedding = await createEmbedding(parsed.data.query);
  const results = await searchChunks({
    userId,
    queryEmbedding: embedding,
    documentId: parsed.data.documentId,
    topK: parsed.data.topK,
  });
  res.json(
    SearchDocumentsResponse.parse(
      results.map((result) => ({ ...result, metadata: result.metadata ?? {} })),
    ),
  );
});

router.post("/chat", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const parsed = AskChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid question" });
    return;
  }

  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.userId, userId),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
  } else {
    const [created] = await db
      .insert(conversationsTable)
      .values({
        userId,
        documentId: parsed.data.documentId ?? null,
        title: parsed.data.question.slice(0, 80),
      })
      .returning();
    conversationId = created.id;
  }

  const history = await db
    .select({ role: messagesTable.role, content: messagesTable.content })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.conversationId, conversationId),
        eq(messagesTable.userId, userId),
      ),
    )
    .orderBy(desc(messagesTable.createdAt))
    .limit(6);
  const embedding = await createEmbedding(parsed.data.question);
  const sources = await searchChunks({
    userId,
    queryEmbedding: embedding,
    documentId: parsed.data.documentId,
    topK: 6,
  });
  const context = sources
    .filter((source) => source.similarity >= Number(process.env.SIMILARITY_THRESHOLD ?? 0.2))
    .map(
      (source, index) =>
        `[Passage ${index + 1}] ${source.documentName}${source.pageNumber ? `, page ${source.pageNumber}` : ""}\n${source.content}`,
    )
    .join("\n\n");
  const answer = context
    ? await generateGroundedAnswer(
        parsed.data.question,
        context,
        history.reverse().map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
      )
    : "I couldn't find enough information about this in the uploaded documents.";
  const sourcePayload = sources.map((source) => ({
    chunkId: source.chunkId,
    documentId: source.documentId,
    documentName: source.documentName,
    content: source.content,
    pageNumber: source.pageNumber,
    similarity: source.similarity,
  }));
  const [userMessage] = await db
    .insert(messagesTable)
    .values({
      conversationId,
      userId,
      role: "user",
      content: parsed.data.question,
      sources: [],
    })
    .returning();
  const [assistantMessage] = await db
    .insert(messagesTable)
    .values({
      conversationId,
      userId,
      role: "assistant",
      content: answer,
      sources: sourcePayload,
    })
    .returning();
  await db
    .update(conversationsTable)
    .set({ messageCount: (history.length + 2), updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversationId));

  res.json(
    AskChatResponse.parse({
      answer,
      sources: sourcePayload,
      conversationId,
      messageId: assistantMessage.id,
    }),
  );
});

export default router;