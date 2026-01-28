import { type File, type InsertFile, files } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getFiles(): Promise<File[]>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, file: Partial<File>): Promise<File | undefined>;
  deleteFile(id: string): Promise<void>;
  incrementDownloadCount(id: string): Promise<File>;
}

export class DatabaseStorage implements IStorage {

  async getFiles(): Promise<File[]> {
    const allFiles = await db.select().from(files).orderBy(files.createdAt);
    // Reverse to get newest first
    return allFiles.reverse();
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    await db.insert(files).values(insertFile);
    const [file] = await db.select().from(files).where(eq(files.id, insertFile.id));
    return file!;
  }

  async updateFile(id: string, updates: Partial<File>): Promise<File | undefined> {
    await db.update(files).set(updates).where(eq(files.id, id));
    const [updatedFile] = await db.select().from(files).where(eq(files.id, id));
    return updatedFile;
  }

  async deleteFile(id: string): Promise<void> {
    await db.delete(files).where(eq(files.id, id));
  }

  async incrementDownloadCount(id: string): Promise<File> {
    await db
      .update(files)
      .set({ downloadCount: sql`${files.downloadCount} + 1` })
      .where(eq(files.id, id));

    const [updatedFile] = await db.select().from(files).where(eq(files.id, id));
    return updatedFile!;
  }
}

export const storage = new DatabaseStorage();
