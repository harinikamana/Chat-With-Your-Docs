import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateConversationBody,
  CreateConversationResponse,
  DeleteConversationParams,
  GetConversationParams,
  GetConversationResponse,
  ListConversationsResponse,
  RenameConversationBody,
  RenameConversationParams,
  RenameConversationResponse,
} from "@workspace/api-zod";
import {
  conversationsTable,
  db,
  messagesTable,
} from "@workspace/db";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/conversations", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const rows = await db
    .select({
      id: conversationsTable.id,
      title: conversationsTable.title,
      documentId: conversationsTable.documentId,
      messageCount: conversationsTable.messageCount,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
    })
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, userId))
    .orderBy(desc(conversationsTable.updatedAt));
  res.json(ListConversationsResponse.parse(rows));
});

router.post("/conversations", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid conversation" });
    return;
  }
  const [conversation] = await db
    .insert(conversationsTable)
    .values({
      userId,
      title: parsed.data.title || "New conversation",
      documentId: parsed.data.documentId ?? null,
    })
    .returning();
  res.status(201).json(
    CreateConversationResponse.parse({ ...conversation, messages: [] }),
  );
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.id),
        eq(conversationsTable.userId, userId),
      ),
    );
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(messagesTable.createdAt);
  res.json(GetConversationResponse.parse({ ...conversation, messages }));
});

router.patch("/conversations/:id", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const params = RenameConversationParams.safeParse(req.params);
  const body = RenameConversationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid conversation update" });
    return;
  }
  const [conversation] = await db
    .update(conversationsTable)
    .set({ title: body.data.title, updatedAt: new Date() })
    .where(
      and(
        eq(conversationsTable.id, params.data.id),
        eq(conversationsTable.userId, userId),
      ),
    )
    .returning();
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(RenameConversationResponse.parse(conversation));
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const deleted = await db
    .delete(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.id),
        eq(conversationsTable.userId, userId),
      ),
    )
    .returning({ id: conversationsTable.id });
  if (!deleted[0]) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;