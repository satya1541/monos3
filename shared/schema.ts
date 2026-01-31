import { sql, relations } from "drizzle-orm";
import { mysqlTable, text, varchar, int, timestamp, index, boolean, primaryKey } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // bcrypt hash
  displayName: varchar("display_name", { length: 100 }),
  role: varchar("role", { length: 20 }).default("user").notNull(), // 'admin' | 'user'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ==================== FILES ====================
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
  // New fields for enhanced functionality
  userId: varchar("user_id", { length: 36 }), // Optional: file owner
  isPrivate: boolean("is_private").default(false).notNull(),
  expiresAt: timestamp("expires_at"), // Optional: link expiration
  maxDownloads: int("max_downloads"), // Optional: download limit
  maxDownloadsPerUser: int("max_downloads_per_user"), // Optional: per-user download limit
  hash: varchar("hash", { length: 64 }), // MD5 or SHA256 hash
  thumbnailUrl: text("thumbnail_url"), // Thumbnail for images/videos
  parentId: varchar("parent_id", { length: 36 }), // For versioning (previous version)
  pin: varchar("pin", { length: 4 }), // 4-digit PIN for private files
}, (table) => [
  index("category_idx").on(table.category),
  index("user_id_idx").on(table.userId),
  index("parent_id_idx").on(table.parentId),
]);

export const filesRelations = relations(files, ({ one, many }) => ({
  owner: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  parent: one(files, {
    fields: [files.parentId],
    references: [files.id],
    relationName: "versions",
  }),
  versions: many(files, { relationName: "versions" }),
  fileTags: many(fileTags),
}));

export const insertFileSchema = createInsertSchema(files).omit({
  createdAt: true,
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

// ==================== TAGS ====================
export const tags = mysqlTable("tags", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tagsRelations = relations(tags, ({ many }) => ({
  fileTags: many(fileTags),
}));

export const insertTagSchema = createInsertSchema(tags).omit({
  createdAt: true,
});

export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;

// ==================== FILE TAGS (Junction Table) ====================
export const fileTags = mysqlTable("file_tags", {
  fileId: varchar("file_id", { length: 36 }).notNull(),
  tagId: varchar("tag_id", { length: 36 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.fileId, table.tagId] }),
  index("file_id_idx").on(table.fileId),
  index("tag_id_idx").on(table.tagId),
]);

export const fileTagsRelations = relations(fileTags, ({ one }) => ({
  file: one(files, {
    fields: [fileTags.fileId],
    references: [files.id],
  }),
  tag: one(tags, {
    fields: [fileTags.tagId],
    references: [tags.id],
  }),
}));

// ==================== DOWNLOAD LOGS (for analytics) ====================
export const downloadLogs = mysqlTable("download_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  fileId: varchar("file_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }), // User who downloaded
  downloadedAt: timestamp("downloaded_at").defaultNow(),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 max length
}, (table) => [
  index("file_id_idx").on(table.fileId),
  index("downloaded_at_idx").on(table.downloadedAt),
]);

export const downloadLogsRelations = relations(downloadLogs, ({ one }) => ({
  file: one(files, {
    fields: [downloadLogs.fileId],
    references: [files.id],
  }),
}));

export type DownloadLog = typeof downloadLogs.$inferSelect;
