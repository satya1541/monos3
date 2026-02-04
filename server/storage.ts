import { type File, type InsertFile, files, users, tags, fileTags, downloadLogs } from "@shared/schema";
import { db } from "./db";
import { eq, sql, or, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getFiles(userId?: string): Promise<File[]>;
  getUserFiles(userId: string): Promise<File[]>;
  getFile(id: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, file: Partial<File>): Promise<File | undefined>;
  deleteFile(id: string): Promise<void>;
  incrementDownloadCount(id: string, userId?: string, ipAddress?: string): Promise<File>;
  addTagsToFile(fileId: string, tagNames: string[]): Promise<void>;
  getFileWithTags(id: string): Promise<File & { tags: string[] }>;
  getFileVersions(id: string): Promise<File[]>;
  getLatestVersionFile(id: string): Promise<File | undefined>;
  getUserDownloadCount(fileId: string, userId: string): Promise<number>;
  getUserStorageUsage(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {

  private groupAndFilterFiles(files: File[]): File[] {
    const groups = new Map<string, File>();
    const childToParent = new Map<string, string>();
    const rootCache = new Map<string, string>();

    // 1. Build adjacency map
    files.forEach(f => { if (f.parentId) childToParent.set(f.id, f.parentId); });

    // 2. Optimized findRoot with Path Compression / Memoization
    const findRoot = (id: string): string => {
      if (rootCache.has(id)) return rootCache.get(id)!;

      let root = id;
      const path: string[] = [];
      let visited = new Set<string>();

      while (childToParent.has(root) && !visited.has(root)) {
        visited.add(root);
        path.push(root); // Store path for compression
        root = childToParent.get(root)!;
      }

      // Path compression: Point all nodes in path directly to root
      for (const node of path) {
        rootCache.set(node, root);
      }
      rootCache.set(root, root); // Root points to itself

      return root;
    };

    // 3. Group by root
    files.forEach(f => {
      const rootId = findRoot(f.id);
      const existing = groups.get(rootId);
      if (!existing || new Date(f.createdAt || 0) > new Date(existing.createdAt || 0)) {
        groups.set(rootId, f);
      }
    });

    return Array.from(groups.values());
  }

  async getFiles(userId?: string): Promise<File[]> {

    let allFiles: File[];

    if (userId) {
      // Show all public files + own private files
      allFiles = await db
        .select()
        .from(files)
        .where(
          or(
            eq(files.isPrivate, false),
            eq(files.userId, userId)
          )
        )
        .orderBy(files.createdAt);
    } else {
      // Unauthenticated view: only public files
      allFiles = await db
        .select()
        .from(files)
        .where(eq(files.isPrivate, false))
        .orderBy(files.createdAt);
    }


    const groupedResult = this.groupAndFilterFiles(allFiles);


    // Sanitize PINs for responses: Remove PIN if not the owner
    return groupedResult.map(f => {
      const { pin, ...sanitized } = f;
      return (userId === f.userId) ? f : sanitized as File;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getUserFiles(userId: string): Promise<File[]> {

    const ownFiles = await db
      .select()
      .from(files)
      .where(eq(files.userId, userId))
      .orderBy(files.createdAt);


    const groupedResult = this.groupAndFilterFiles(ownFiles);


    // Files in this route are owned by the userId passed, so we can return them as is
    return groupedResult.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file;
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

  async incrementDownloadCount(fileId: string, userId?: string, ipAddress?: string): Promise<File> {
    await db
      .update(files)
      .set({ downloadCount: sql`${files.downloadCount} + 1` })
      .where(eq(files.id, fileId));

    // Log the download with optional userId
    await db.insert(downloadLogs).values({
      id: randomUUID(),
      fileId,
      userId,
      ipAddress,
    });

    const [updatedFile] = await db.select().from(files).where(eq(files.id, fileId));
    return updatedFile!;
  }

  async addTagsToFile(fileId: string, tagNames: string[]): Promise<void> {
    for (const name of tagNames) {
      const normalized = name.toLowerCase().trim();
      // 1. Get or create tag
      let [tag] = await db.select().from(tags).where(eq(tags.name, normalized));
      if (!tag) {
        const id = randomUUID();
        await db.insert(tags).values({ id, name: normalized });
        [tag] = await db.select().from(tags).where(eq(tags.id, id));
      }

      // 2. Link to file
      if (tag) {
        // Check if linkage already exists
        const [existing] = await db
          .select()
          .from(fileTags)
          .where(sql`${fileTags.fileId} = ${fileId} AND ${fileTags.tagId} = ${tag.id}`);

        if (!existing) {
          await db.insert(fileTags).values({ fileId, tagId: tag.id });
        }
      }
    }
  }

  async getFileWithTags(id: string): Promise<File & { tags: string[] }> {
    const file = await this.getFile(id);
    if (!file) throw new Error("File not found");

    const tagsList = await db
      .select({ name: tags.name })
      .from(fileTags)
      .innerJoin(tags, eq(fileTags.tagId, tags.id))
      .where(eq(fileTags.fileId, id));

    return {
      ...file,
      tags: tagsList.map(t => t.name),
    };
  }

  async getFileVersions(id: string): Promise<File[]> {
    const all = await db.select().from(files);

    const childToParent = new Map<string, string>();
    all.forEach(f => { if (f.parentId) childToParent.set(f.id, f.parentId); });

    const findRoot = (id: string): string => {
      let root = id;
      let visited = new Set<string>();
      while (childToParent.has(root) && !visited.has(root)) {
        visited.add(root);
        root = childToParent.get(root)!;
      }
      return root;
    };

    const targetRootId = findRoot(id);

    // Find all files that share this root
    const versions = all.filter(f => findRoot(f.id) === targetRootId);

    // Sort by creation date (newest first)
    return versions.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getLatestVersionFile(id: string): Promise<File | undefined> {
    const versions = await this.getFileVersions(id);
    return versions[0]; // versions are already sorted desc by createdAt
  }

  async getUserDownloadCount(fileId: string, userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(downloadLogs)
      .where(
        and(
          eq(downloadLogs.fileId, fileId),
          eq(downloadLogs.userId, userId)
        )
      );
    return Number(result?.count || 0);
  }

  async getUserStorageUsage(userId: string): Promise<number> {
    const [result] = await db
      .select({ totalSize: sql<string>`sum(${files.size})` })
      .from(files)
      .where(eq(files.userId, userId));
    return result?.totalSize ? parseInt(result.totalSize) : 0;
  }
}

export const storage = new DatabaseStorage();
