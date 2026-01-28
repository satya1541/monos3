import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, int, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const files = mysqlTable("files", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 500 }).notNull(), // S3 object key
  url: text("url").notNull(), // Public/signed URL
  type: varchar("type", { length: 100 }).notNull(), // MIME type
  size: int("size").notNull(), // Bytes
  category: varchar("category", { length: 100 }), // e.g. "game", "video", "document"
  downloadCount: int("download_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileSchema = createInsertSchema(files).omit({
  createdAt: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;
