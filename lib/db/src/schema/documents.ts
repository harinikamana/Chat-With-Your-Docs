import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const documentStatus = [
  "UPLOADING",
  "UPLOADED",
  "PROCESSING",
  "EMBEDDING",
  "READY",
  "FAILED",
] as const;

export const documentsTable = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalFilename: varchar("original_filename", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 100 }).notNull(),
    fileSize: integer("file_size").notNull(),
    storagePath: text("storage_path"),
    status: varchar("status", { length: 24 }).notNull().default("UPLOADED"),
    pageCount: integer("page_count"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("documents_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    userStatusIdx: index("documents_user_status_idx").on(
      table.userId,
      table.status,
    ),
  }),
);

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;