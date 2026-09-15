import { createInsertSchema } from "drizzle-zod";
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType: () => "vector(1536)",
  toDriver: (value) => `[${value.join(",")}]`,
  fromDriver: (value) =>
    String(value)
      .slice(1, -1)
      .split(",")
      .filter(Boolean)
      .map(Number),
});

export const documentChunksTable = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").notNull(),
    userId: text("user_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    pageNumber: integer("page_number"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentChunkIdx: index("document_chunks_document_idx").on(
      table.documentId,
      table.chunkIndex,
    ),
    userChunkIdx: index("document_chunks_user_idx").on(table.userId),
  }),
);

export const insertDocumentChunkSchema = createInsertSchema(
  documentChunksTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentChunk = typeof documentChunksTable.$inferSelect;