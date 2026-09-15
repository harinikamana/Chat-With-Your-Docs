import { createInsertSchema } from "drizzle-zod";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type MessageSource = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number | null;
  similarity: number;
};

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
    userId: text("user_id").notNull(),
    role: varchar("role", { length: 16 }).notNull(),
    content: text("content").notNull(),
    sources: jsonb("sources").$type<MessageSource[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationCreatedIdx: index("messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    userMessageIdx: index("messages_user_idx").on(table.userId),
  }),
);

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;