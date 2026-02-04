import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { getPresignedDownloadUrl, getPresignedUploadUrl, deleteFromS3 } from "./s3";
import { randomUUID, timingSafeEqual } from "crypto";
import { broadcastNewFile, broadcastDeleteFile, broadcastUpdateFile } from "./websocket";
import { isAuthenticated } from "./auth";
import { insertFileSchema } from "@shared/schema";
import { z } from "zod";
import { createRateLimiter } from "./rate-limit";
import { MAX_STORAGE_PER_USER_BYTES } from "./constants";

// Helper for constant-time comparison (prevents timing attacks)
function compare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

const pinRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many PIN attempts from this IP, please try again after 15 minutes"
});

const uploadUrlSchema = z.object({
  filename: z.string().min(1),
  type: z.string().min(1),
});

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderErrorPage(res: Response, title: string, message: string, code: number = 400) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return res.status(code).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${safeTitle} - Mono S3</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #111; padding: 3rem; border: 1px solid #333; max-width: 450px; width: 90%; text-align: center; border-radius: 4px; }
        .icon { font-size: 3rem; margin-bottom: 1.5rem; opacity: 0.5; }
        h1 { font-family: serif; margin-bottom: 1rem; font-weight: 500; font-size: 1.5rem; letter-spacing: 0.05em; }
        p { opacity: 0.6; line-height: 1.6; font-size: 0.95rem; margin-bottom: 2rem; }
        .btn { display: inline-block; background: #fff; color: #000; text-decoration: none; padding: 0.8rem 2rem; text-transform: uppercase; font-weight: bold; font-size: 0.8rem; letter-spacing: 0.1em; border-radius: 2px; }
        .code { margin-top: 2rem; font-size: 0.7rem; opacity: 0.2; text-transform: uppercase; letter-spacing: 0.2em; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">×</div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        <a href="/" class="btn">Return Home</a>
        <div class="code">Error Code: ${code}</div>
      </div>
    </body>
    </html>
  `);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // GET /api/files - List all uploaded files
  app.get("/api/files", async (req, res) => {
    const userId = req.isAuthenticated() ? (req.user as any).id : undefined;


    // Prevent caching of the file list to ensure newly uploaded private files show up
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const files = await storage.getFiles(userId);
    res.json(files);
  });

  // GET /api/stats - Dashboard statistics
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const files = await storage.getUserFiles(userId);

      const totalFiles = files.length;
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const totalDownloads = files.reduce((acc, f) => acc + f.downloadCount, 0);

      // Top 5 most downloaded
      const topDownloaded = [...files]
        .sort((a, b) => b.downloadCount - a.downloadCount)
        .slice(0, 5)
        .map(f => ({ id: f.id, name: f.name, downloads: f.downloadCount }));

      // Category distribution
      const categoryMap: Record<string, number> = {};
      for (const file of files) {
        const cat = file.category || "other";
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      }
      const categoryDistribution = Object.entries(categoryMap).map(([name, count]) => ({ name, count }));

      // Recent files (last 10)
      const recentFiles = [...files]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 10)
        .map(f => ({ id: f.id, name: f.name, createdAt: f.createdAt }));

      res.json({
        totalFiles,
        totalSize,
        totalDownloads,
        topDownloaded,
        categoryDistribution,
        recentFiles,
      });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // GET /api/files/:id/download - Download a file with original name
  app.get("/api/files/:id/download", async (req, res) => {
    try {
      const fileId = req.params.id as string;
      const file = await storage.getFile(fileId);

      if (!file) {
        return renderErrorPage(res, "File Not Found", "The file you are looking for does not exist or has been removed.", 404);
      }

      // 0. Security Policy: Enforce LATEST version's security settings
      const latestVersion = await storage.getLatestVersionFile(file.id);
      const securityPolicy = latestVersion || file; // Fallback to file if single version

      const isOwner = req.isAuthenticated() && (req.user as any).id === securityPolicy.userId;
      const isPreview = req.query.preview === 'true';
      const pin = req.query.pin as string;



      // 1. Strict Security Rule: Prohibit previews for private/PIN-protected files entirely
      if ((securityPolicy.isPrivate || securityPolicy.pin) && isPreview) {

        return renderErrorPage(res, "Preview Disabled", "Previews are disabled for private/PIN-protected files for enhanced security.", 403);
      }

      // 2. Check Privacy & PIN (for downloads/previews)
      if (securityPolicy.isPrivate) {
        if (!isOwner) {
          if (!securityPolicy.pin || !compare(securityPolicy.pin, pin || "")) {

            return renderErrorPage(res, "Access Denied", "This file is private and requires a valid PIN for access.", 403);
          }
        }
      } else if (securityPolicy.pin && !isOwner) {
        // Not private but has PIN? Enforce it.
        if (!compare(securityPolicy.pin, pin || "")) {

          return renderErrorPage(res, "Invalid PIN", "The PIN provided is incorrect or missing. Please check the PIN and try again.", 403);
        }
      }

      // 3. Check Expiration
      if (securityPolicy.expiresAt && new Date(securityPolicy.expiresAt).getTime() < Date.now()) {
        return renderErrorPage(res, "Link Expired", "This file sharing link has expired and is no longer active.", 410);
      }

      // 4. Check Download Limit (Skip for previews)
      if (!isPreview) {
        if (securityPolicy.maxDownloads && securityPolicy.downloadCount >= securityPolicy.maxDownloads) {
          return renderErrorPage(res, "Limit Reached", "The maximum download limit for this file has been reached.", 410);
        }

        // 4b. Check Per-User Download Limit
        if (securityPolicy.maxDownloadsPerUser) {
          if (!req.isAuthenticated()) {
            return renderErrorPage(res, "Authentication Required", "This file has a per-user download limit and requires you to be logged in.", 401);
          }
          const currentUserId = (req.user as any).id;
          const userDownloadCount = await storage.getUserDownloadCount(securityPolicy.id, currentUserId);
          if (userDownloadCount >= securityPolicy.maxDownloadsPerUser) {
            return renderErrorPage(res, "Limit Reached", `You have reached your personal download limit for this file (${securityPolicy.maxDownloadsPerUser}).`, 403);
          }
        }
      }

      const url = await getPresignedDownloadUrl(file.key, file.name, isPreview);

      if (!isPreview) {
        // Increment download count and log IP
        const currentUserId = req.isAuthenticated() ? (req.user as any).id : undefined;
        const updatedFile = await storage.incrementDownloadCount(file.id, currentUserId, req.ip);
        broadcastUpdateFile(updatedFile);
      }

      res.redirect(url);
    } catch (error) {
      console.error("Download error:", error);
      return renderErrorPage(res, "Server Error", "Something went wrong while generating the download link. Please try again later.", 500);
    }
  });

  // GET /link/:id - Direct download (short link)
  app.get("/link/:id", pinRateLimiter, async (req, res) => {
    try {
      const fileId = req.params.id as string;
      const file = await storage.getFile(fileId);

      if (!file) {
        return res.status(404).send("File not found");
      }

      // 0. Security Policy: Enforce LATEST version's security settings
      const latestVersion = await storage.getLatestVersionFile(file.id);
      const securityPolicy = latestVersion || file;

      const isOwner = req.isAuthenticated() && (req.user as any).id === securityPolicy.userId;
      const isPreview = req.query.preview === 'true';
      const pin = req.query.pin as string;



      // 1. Strict Security Rule: Prohibit previews for private/PIN-protected files
      if ((securityPolicy.isPrivate || securityPolicy.pin) && isPreview) {

        return res.status(403).send("Forbidden: Previews are disabled for private files.");
      }

      // 2. Check Expiration
      if (securityPolicy.expiresAt && new Date(securityPolicy.expiresAt).getTime() < Date.now()) {
        return renderErrorPage(res, "Link Expired", "This sharing link has reached its expiration date and is no longer active.", 410);
      }

      // 3. Check and Prompt for PIN
      const requiresPin = (securityPolicy.isPrivate || securityPolicy.pin) && !isOwner;
      if (requiresPin) {
        const pinValid = pin && securityPolicy.pin && compare(securityPolicy.pin, pin);

        if (!pinValid) {
          // If invalid PIN or no PIN, forbid "private" files entirely if they have no PIN set (shouldn't happen for private files usually?)
          // Actually storage.ts sanitizes PINs, so safe to check logic here.
          // If Private and NO PIN set on file? It's just private (Owner only). 
          if (securityPolicy.isPrivate && !securityPolicy.pin) {
            return renderErrorPage(res, "Access Denied", "This file is private.", 403);
          }

          // Render PIN Entry Page
          return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>PIN Required - Mono S3</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #111; padding: 2rem; border: 1px solid #333; max-width: 400px; width: 90%; text-align: center; }
                h1 { font-family: serif; margin-bottom: 1rem; }
                input { background: transparent; border: 1px solid #333; color: #fff; padding: 0.8rem; width: 100%; box-sizing: border-box; margin-bottom: 1rem; text-align: center; letter-spacing: 0.5rem; font-size: 1.2rem; }
                button { background: #fff; color: #000; border: none; padding: 0.8rem 2rem; cursor: pointer; text-transform: uppercase; font-weight: bold; width: 100%; }
                .error { color: #fecaca; font-size: 0.8rem; margin-top: 1rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>PIN Protected</h1>
                <p style="opacity: 0.5; font-size: 0.9rem; margin-bottom: 2rem;">Enter the 4-digit PIN to access this file.</p>
                <form method="GET">
                  <input type="password" name="pin" maxlength="4" placeholder="****" required autofocus>
                  <button type="submit">Download</button>
                </form>
                ${pin ? '<div class="error">Incorrect PIN. Please try again.</div>' : ''}
              </div>
            </body>
            </html>
          `);
        }
      }

      // 4. Check Download Limit
      if (!isPreview) {
        if (securityPolicy.maxDownloads && securityPolicy.downloadCount >= securityPolicy.maxDownloads) {
          return renderErrorPage(res, "Limit Reached", "The maximum number of downloads for this file has been exceeded.", 410);
        }

        // 4b. Check Per-User Download Limit
        if (securityPolicy.maxDownloadsPerUser) {
          if (!req.isAuthenticated()) {
            return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
          }
          const currentUserId = (req.user as any).id;
          const userDownloadCount = await storage.getUserDownloadCount(securityPolicy.id, currentUserId);
          if (userDownloadCount >= securityPolicy.maxDownloadsPerUser) {
            return renderErrorPage(res, "Limit Reached", `You have reached your personal download limit for this file (${securityPolicy.maxDownloadsPerUser}).`, 403);
          }
        }
      }

      const url = await getPresignedDownloadUrl(file.key, file.name, isPreview);

      if (!isPreview) {
        const currentUserId = req.isAuthenticated() ? (req.user as any).id : undefined;
        const updatedFile = await storage.incrementDownloadCount(file.id, currentUserId, req.ip);
        broadcastUpdateFile(updatedFile);
      }

      res.redirect(url);
    } catch (error) {
      console.error("Link error:", error);
      res.status(500).send("Error generating link");
    }
  });

  // GET /link/:id/:filename - Direct download with filename
  app.get("/link/:id/:filename", async (req, res) => {
    try {
      const fileId = req.params.id as string;
      const file = await storage.getFile(fileId);

      if (!file) {
        return renderErrorPage(res, "File Not Found", "The file you are looking for does not exist or has been removed.", 404);
      }

      // 0. Security Policy: Enforce LATEST version's security settings
      const latestVersion = await storage.getLatestVersionFile(file.id);
      const securityPolicy = latestVersion || file;

      const isOwner = req.isAuthenticated() && (req.user as any).id === securityPolicy.userId;
      const isPreview = req.query.preview === 'true';
      const pin = req.query.pin as string;



      // 1. Strict Security Rule: Prohibit previews for private/PIN-protected files
      if ((securityPolicy.isPrivate || securityPolicy.pin) && isPreview) {
        return renderErrorPage(res, "Preview Disabled", "Previews are disabled for private/PIN-protected files.", 403);
      }

      // 2. Apply the same security logic
      if (securityPolicy.isPrivate) {
        if (!isOwner) {
          if (!securityPolicy.pin || !compare(securityPolicy.pin, pin || "")) {
            // If has PIN but not provided, redirect to pin entry page
            if (securityPolicy.pin && !pin) {

              return res.redirect(`/link/${file.id}`);
            }

            return renderErrorPage(res, "Access Denied", "This file is private and requires a valid PIN for access.", 403);
          }
        }
      } else if (securityPolicy.pin && !isOwner) {
        if (!compare(securityPolicy.pin, pin || "")) {
          if (!pin) {

            return res.redirect(`/link/${file.id}`);
          }

          return renderErrorPage(res, "Invalid PIN", "The PIN provided is incorrect. Please check the PIN and try again.", 403);
        }
      }

      // Check Expiration
      if (securityPolicy.expiresAt && new Date(securityPolicy.expiresAt).getTime() < Date.now()) {
        return renderErrorPage(res, "Link Expired", "This file sharing link has expired.", 410);
      }

      // Check Download Limit
      if (!isPreview) {
        if (securityPolicy.maxDownloads && securityPolicy.downloadCount >= securityPolicy.maxDownloads) {
          return renderErrorPage(res, "Limit Reached", "The maximum download limit for this file has been reached.", 410);
        }

        // Check Per-User Download Limit
        if (securityPolicy.maxDownloadsPerUser) {
          if (!req.isAuthenticated()) {
            return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
          }
          const currentUserId = (req.user as any).id;
          const userDownloadCount = await storage.getUserDownloadCount(securityPolicy.id, currentUserId);
          if (userDownloadCount >= securityPolicy.maxDownloadsPerUser) {
            return renderErrorPage(res, "Limit Reached", `You have reached your personal download limit for this file (${securityPolicy.maxDownloadsPerUser}).`, 403);
          }
        }
      }

      const url = await getPresignedDownloadUrl(file.key, file.name, isPreview);

      if (!isPreview) {
        const currentUserId = req.isAuthenticated() ? (req.user as any).id : undefined;
        const updatedFile = await storage.incrementDownloadCount(file.id, currentUserId, req.ip);
        broadcastUpdateFile(updatedFile);
      }

      res.redirect(url);
    } catch (error) {
      console.error("Link error:", error);
      res.status(500).send("Error generating link");
    }
  });


  // GET /api/files/bulk - Debug to find who is calling this
  app.get("/api/files/bulk", (req, res) => {

    res.status(404).json({ error: "Bulk GET not supported" });
  });

  // DELETE /api/files/bulk - Delete multiple files (Owned only)
  app.delete("/api/files/bulk", isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      const userId = (req.user as any).id;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }

      const errors: string[] = [];
      let successCount = 0;
      for (const id of ids) {
        try {
          const file = await storage.getFile(id);
          if (file) {
            // Check ownership
            if (file.userId !== userId) {
              errors.push(`${id}: Permission Denied`);
              continue;
            }

            try {
              await deleteFromS3(file.key);
            } catch (s3Error) {
              console.error(`S3 delete warning for ${id}:`, s3Error);
            }
            await storage.deleteFile(id);
            broadcastDeleteFile(id);
            successCount++;
          }
        } catch (err) {
          errors.push(id);
        }
      }

      if (errors.length > 0) {
        return res.status(207).json({ message: "Some files failed to delete", successCount, errors });
      }

      res.json({ message: `${successCount} files deleted` });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ error: "Failed to delete files" });
    }
  });

  // PATCH /api/files/bulk - Update category for multiple files (Owned only)
  app.patch("/api/files/bulk", isAuthenticated, async (req, res) => {
    try {
      const { ids, category } = req.body;
      const userId = (req.user as any).id;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      if (!category) {
        return res.status(400).json({ error: "category is required" });
      }

      const updated: string[] = [];
      for (const id of ids) {
        try {
          const file = await storage.getFile(id);
          if (file && file.userId === userId) {
            const updatedFile = await storage.updateFile(id, { category });
            if (updatedFile) {
              updated.push(id);
              broadcastUpdateFile(updatedFile);
            }
          }
        } catch (err) {
          console.error(`Failed to update ${id}:`, err);
        }
      }

      res.json({ message: `${updated.length} files updated`, updated });
    } catch (error) {
      console.error("Bulk update error:", error);
      res.status(500).json({ error: "Failed to update files" });
    }
  });

  // PATCH /api/files/:id - Update file details (Owner only)
  app.patch("/api/files/:id", isAuthenticated, async (req, res) => {
    try {
      const { name, category, isPrivate, pin, expiresAt, maxDownloads, maxDownloadsPerUser } = req.body;
      const userId = (req.user as any).id;

      const file = await storage.getFile(req.params.id as string);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      if (file.userId !== userId) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const updates: Partial<any> = {};
      if (name !== undefined) updates.name = name;
      if (category !== undefined) updates.category = category;
      if (isPrivate !== undefined) updates.isPrivate = isPrivate;
      if (pin !== undefined) updates.pin = pin;
      if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      if (maxDownloads !== undefined) updates.maxDownloads = maxDownloads ? parseInt(maxDownloads) : null;
      if (maxDownloadsPerUser !== undefined) updates.maxDownloadsPerUser = maxDownloadsPerUser ? parseInt(maxDownloadsPerUser) : null;

      const updatedFile = await storage.updateFile(req.params.id as string, updates);
      res.json(updatedFile);
      broadcastUpdateFile(updatedFile!);
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  // DELETE /api/files/:id - Delete a file (Owner only)
  app.delete("/api/files/:id", isAuthenticated, async (req, res) => {
    try {
      const fileId = req.params.id as string;
      const userId = (req.user as any).id;
      const file = await storage.getFile(fileId);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      if (file.userId !== userId) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // Delete from S3
      try {
        await deleteFromS3(file.key);
      } catch (error) {
        console.error("S3 Delete Warning:", error);
        // Continue to delete from DB even if S3 fails (or consistency check needed?)
        // For now, proceed to allow cleanup of "zombie" DB records
      }

      // Delete from DB
      await storage.deleteFile(fileId as string);

      // Broadcast deletion
      broadcastDeleteFile(fileId as string);

      res.sendStatus(204);
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // POST /api/upload-url - Get presigned URL for direct upload
  app.post("/api/upload-url", isAuthenticated, async (req, res) => {
    try {
      const result = uploadUrlSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request data", details: result.error.format() });
      }

      const userId = (req.user as any).id;
      // Storage limit check removed per user request

      const { filename, type } = result.data;

      const id = randomUUID();
      const ext = filename.split(".").pop() || "";
      const key = `uploads/${id}.${ext}`;

      const url = await getPresignedUploadUrl(key, type);

      res.json({ url, key, id });
    } catch (error) {
      console.error("Presigned URL error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // POST /api/files - Save metadata (Direct Upload Sync)
  app.post("/api/files", isAuthenticated, async (req, res) => {
    try {


      const result = insertFileSchema.safeParse({
        ...req.body,
        size: typeof req.body.size === 'string' ? parseInt(req.body.size) : req.body.size,
        category: req.body.category || "other",
        userId: req.isAuthenticated() ? (req.user as any).id : null,
        isPrivate: req.body.isPrivate === 'true' || req.body.isPrivate === true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
        maxDownloadsPerUser: req.body.maxDownloadsPerUser ? parseInt(req.body.maxDownloadsPerUser) : null,
        pin: req.body.pin ? req.body.pin : null,
      });



      if (!result.success) {
        return res.status(400).json({ error: "Invalid file metadata", details: result.error.format() });
      }

      // Security Check: Version Injection Prevention
      if (result.data.parentId) {
        const parentFile = await storage.getFile(result.data.parentId);
        if (!parentFile) {
          return res.status(404).json({ error: "Parent file not found" });
        }
        if (req.isAuthenticated() && parentFile.userId !== (req.user as any).id) {
          console.warn(`[Security] Version Injection Attempt detected! User ${(req.user as any).id} tried to append to parent ${parentFile.id}`);
          return res.status(403).json({ error: "You cannot add a version to a file you do not own." });
        }
      }

      const file = await storage.createFile(result.data);

      // Handle tags if provided
      if (req.body.tags) {
        const tagList = Array.isArray(req.body.tags)
          ? req.body.tags
          : (typeof req.body.tags === 'string' ? req.body.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : []);

        if (tagList.length > 0) {
          await storage.addTagsToFile(file.id, tagList);
        }
      }

      res.json(file);
      broadcastNewFile(file);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to save file metadata" });
    }
  });

  // POST /api/files/metadata - Save metadata and tags
  app.post("/api/files/metadata", isAuthenticated, async (req, res) => {
    try {
      const { id, tags } = req.body;
      if (!id) return res.status(400).json({ error: "id is required" });

      if (tags && Array.isArray(tags)) {
        await storage.addTagsToFile(id, tags);
      }

      const fileWithTags = await storage.getFileWithTags(id);
      res.json(fileWithTags);
      broadcastUpdateFile(fileWithTags as any);
    } catch (error) {
      console.error("Metadata error:", error);
      res.status(500).json({ error: "Failed to save metadata" });
    }
  });

  // GET /api/files/:id/versions - Get file history
  app.get("/api/files/:id/versions", async (req, res) => {
    try {
      const fileId = req.params.id as string;
      const file = await storage.getFile(fileId);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // If private, only owner can see versions
      const isOwner = req.isAuthenticated() && (req.user as any).id === file.userId;
      if (file.isPrivate && !isOwner) {
        return res.status(403).json({ error: "Access denied" });
      }

      let versions = await storage.getFileVersions(fileId);

      // Sanitize versions
      versions = versions.map(v => {
        const { pin, ...sanitized } = v;
        return isOwner ? v : sanitized as any;
      });

      res.json(versions);
    } catch (error) {
      console.error("Versions error:", error);
      res.status(500).json({ error: "Failed to get versions" });
    }
  });

  return httpServer;
}
