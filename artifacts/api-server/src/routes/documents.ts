import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateDocumentBody,
  CreateDocumentResponse,
  DeleteDocumentParams,
  GetDocumentParams,
  GetDocumentResponse,
  ListDocumentsResponse,
  ProcessDocumentParams,
  ProcessDocumentResponse,
  RenameDocumentBody,
  RenameDocumentParams,
  RenameDocumentResponse,
} from "@workspace/api-zod";
import {
  db,
  documentChunksTable,
  documentsTable,
  conversationsTable,
} from "@workspace/db";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/requireAuth";
import { processDocument } from "../lib/documents";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
router.use(requireAuth);

router.get("/documents", async (req, res): Promise<void> => {
  const documents = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.userId, getAuthenticatedUserId(req)!))
    .orderBy(desc(documentsTable.createdAt));
  res.json(ListDocumentsResponse.parse(documents));
});

router.post("/documents", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document metadata" });
    return;
  }

  const [document] = await db
    .insert(documentsTable)
    .values({
      ...parsed.data,
      userId,
      status: "UPLOADED",
    })
    .returning();

  try {
    await objectStorage.trySetObjectEntityAclPolicy(parsed.data.storagePath, {
      owner: userId,
      visibility: "private",
    });
  } catch (error) {
    req.log.warn({ err: error, documentId: document.id }, "Could not set object ACL");
  }

  res.status(201).json(CreateDocumentResponse.parse(document));
});

router.get("/documents/:id", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const [document] = await db
    .select({
      document: documentsTable,
      chunkCount: sql<number>`count(${documentChunksTable.id})::int`,
    })
    .from(documentsTable)
    .leftJoin(
      documentChunksTable,
      eq(documentChunksTable.documentId, documentsTable.id),
    )
    .where(
      and(
        eq(documentsTable.id, params.data.id),
        eq(documentsTable.userId, userId),
      ),
    )
    .groupBy(documentsTable.id);
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(
    GetDocumentResponse.parse({
      ...document.document,
      chunkCount: document.chunkCount,
    }),
  );
});

router.patch("/documents/:id", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const params = RenameDocumentParams.safeParse(req.params);
  const body = RenameDocumentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid document update" });
    return;
  }
  const [document] = await db
    .update(documentsTable)
    .set({ filename: body.data.filename, updatedAt: new Date() })
    .where(
      and(
        eq(documentsTable.id, params.data.id),
        eq(documentsTable.userId, userId),
      ),
    )
    .returning();
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(RenameDocumentResponse.parse(document));
});

router.post("/documents/:id/process", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const params = ProcessDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const [document] = await db
    .update(documentsTable)
    .set({ status: "PROCESSING", updatedAt: new Date() })
    .where(
      and(
        eq(documentsTable.id, params.data.id),
        eq(documentsTable.userId, userId),
      ),
    )
    .returning();
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  void processDocument(document.id, userId);
  res.status(202).json(ProcessDocumentResponse.parse(document));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req)!;
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const [document] = await db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.id, params.data.id),
        eq(documentsTable.userId, userId),
      ),
    );
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .update(conversationsTable)
      .set({ documentId: null, updatedAt: new Date() })
      .where(
        and(
          eq(conversationsTable.documentId, document.id),
          eq(conversationsTable.userId, userId),
        ),
      );
    await tx
      .delete(documentChunksTable)
      .where(eq(documentChunksTable.documentId, document.id));
    await tx.delete(documentsTable).where(eq(documentsTable.id, document.id));
  });
  if (document.storagePath) {
    try {
      const file = await objectStorage.getObjectEntityFile(document.storagePath);
      await file.delete();
    } catch (error) {
      req.log.warn({ err: error, documentId: document.id }, "Could not delete object");
    }
  }
  res.sendStatus(204);
});

export default router;