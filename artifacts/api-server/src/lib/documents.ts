import { PDFParse } from "pdf-parse";
import { sql } from "drizzle-orm";
import { db, documentChunksTable, documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { createEmbedding } from "./ai";
import { logger } from "./logger";

type PageText = { pageNumber: number | null; text: string };

const objectStorage = new ObjectStorageService();

function cleanText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkPages(pages: PageText[]): Array<{
  content: string;
  pageNumber: number | null;
  metadata: Record<string, unknown>;
}> {
  const maxChars = Number(process.env.CHUNK_SIZE_CHARS ?? 4200);
  const overlapChars = Number(process.env.CHUNK_OVERLAP_CHARS ?? 600);
  const chunks: Array<{
    content: string;
    pageNumber: number | null;
    metadata: Record<string, unknown>;
  }> = [];

  for (const page of pages) {
    const paragraphs = cleanText(page.text)
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    let buffer = "";
    for (const paragraph of paragraphs) {
      if (buffer && buffer.length + paragraph.length + 2 > maxChars) {
        chunks.push({
          content: buffer,
          pageNumber: page.pageNumber,
          metadata: { source: "document", characters: buffer.length },
        });
        buffer = buffer.slice(Math.max(0, buffer.length - overlapChars));
      }
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
    if (buffer) {
      chunks.push({
        content: buffer,
        pageNumber: page.pageNumber,
        metadata: { source: "document", characters: buffer.length },
      });
    }
  }

  return chunks.filter((chunk) => chunk.content.length >= 40);
}

async function extractPages(
  buffer: Buffer,
  fileType: string,
): Promise<{ pages: PageText[]; pageCount: number | null }> {
  if (fileType === "text/plain") {
    return { pages: [{ pageNumber: null, text: buffer.toString("utf8") }], pageCount: null };
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pages = result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text,
    }));
    return { pages, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

export async function processDocument(
  documentId: string,
  userId: string,
): Promise<void> {
  const [document] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, documentId));
  if (!document || document.userId !== userId || !document.storagePath) {
    throw new Error("Document not found");
  }

  try {
    await db
      .update(documentsTable)
      .set({ status: "PROCESSING", errorMessage: null, updatedAt: new Date() })
      .where(eq(documentsTable.id, document.id));

    const objectFile = await objectStorage.getObjectEntityFile(document.storagePath);
    const [buffer] = await objectFile.download();
    const extracted = await extractPages(buffer, document.fileType);
    const chunks = chunkPages(extracted.pages);
    if (chunks.length === 0) {
      throw new Error("No readable text was found in this document");
    }

    await db
      .delete(documentChunksTable)
      .where(eq(documentChunksTable.documentId, document.id));
    await db
      .update(documentsTable)
      .set({
        status: "EMBEDDING",
        pageCount: extracted.pageCount,
        updatedAt: new Date(),
      })
      .where(eq(documentsTable.id, document.id));

    for (let index = 0; index < chunks.length; index += 1) {
      const embedding = await createEmbedding(chunks[index].content);
      await db.insert(documentChunksTable).values({
        documentId: document.id,
        userId,
        chunkIndex: index,
        content: chunks[index].content,
        pageNumber: chunks[index].pageNumber,
        metadata: chunks[index].metadata,
        embedding,
      });
    }

    await db
      .update(documentsTable)
      .set({ status: "READY", updatedAt: new Date() })
      .where(eq(documentsTable.id, document.id));
    logger.info({ documentId, userId, chunks: chunks.length }, "Document ready");
  } catch (error) {
    logger.error({ err: error, documentId, userId }, "Document processing failed");
    await db
      .update(documentsTable)
      .set({
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Processing failed",
        updatedAt: new Date(),
      })
      .where(eq(documentsTable.id, document.id));
  }
}

export async function searchChunks({
  userId,
  queryEmbedding,
  documentId,
  topK = 5,
}: {
  userId: string;
  queryEmbedding: number[];
  documentId?: string | null;
  topK?: number;
}) {
  const vectorLiteral = JSON.stringify(queryEmbedding);
  const documentFilter = documentId
    ? sql`and dc.document_id = ${documentId}`
    : sql``;
  const result = await db.execute(sql`
    select
      dc.id as "chunkId",
      dc.document_id as "documentId",
      d.filename as "documentName",
      dc.content,
      dc.page_number as "pageNumber",
      (1 - (dc.embedding <=> ${vectorLiteral}::vector))::float as similarity,
      dc.metadata
    from document_chunks dc
    inner join documents d on d.id = dc.document_id
    where dc.user_id = ${userId}
      and d.user_id = ${userId}
      and dc.embedding is not null
      ${documentFilter}
    order by dc.embedding <=> ${vectorLiteral}::vector
    limit ${Math.min(Math.max(topK, 1), 20)}
  `);
  return result.rows as Array<{
    chunkId: string;
    documentId: string;
    documentName: string;
    content: string;
    pageNumber: number | null;
    similarity: number;
    metadata?: Record<string, unknown>;
  }>;
}