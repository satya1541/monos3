import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { uploadToS3, getPresignedDownloadUrl, getPresignedUploadUrl, deleteFromS3 } from "./s3";
import multer from "multer";
import { randomUUID } from "crypto";
import { broadcastNewFile, broadcastDeleteFile } from "./websocket";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Infinity, fieldSize: Infinity },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // GET /api/files - List all uploaded files
  app.get("/api/files", async (_req, res) => {
    const files = await storage.getFiles();
    res.json(files);
  });

  // GET /api/files/:id/download - Download a file with original name
  app.get("/api/files/:id/download", async (req, res) => {
    try {
      const fileId = req.params.id;
      // We need to implement getFile(id) in storage first
      // But for now, let's filter from getFiles() as a workaround or implement it properly
      // Actually, let's just implement getFile in storage properly first.
      // Wait, I can't change storage easily in this tool call.
      // Let's use getFiles() and find it for now, it's inefficient but works.
      const files = await storage.getFiles();
      const file = files.find(f => f.id === fileId);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const url = await getPresignedDownloadUrl(file.key, file.name);

      // Increment download count
      const updatedFile = await storage.incrementDownloadCount(file.id);
      broadcastNewFile(updatedFile);

      res.redirect(url);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to generate download link" });
    }
  });

  // GET /link/:id - Direct download (short link)
  app.get("/link/:id", async (req, res) => {
    try {
      const fileId = req.params.id;
      const files = await storage.getFiles();
      const file = files.find(f => f.id === fileId);

      if (!file) {
        return res.status(404).send("File not found");
      }

      const url = await getPresignedDownloadUrl(file.key, file.name);

      // Increment download count
      const updatedFile = await storage.incrementDownloadCount(file.id);
      broadcastNewFile(updatedFile);

      res.redirect(url);
    } catch (error) {
      console.error("Link error:", error);
      res.status(500).send("Error generating link");
    }
  });

  // GET /link/:id/:filename - Direct download with filename
  app.get("/link/:id/:filename", async (req, res) => {
    try {
      const fileId = req.params.id;
      const files = await storage.getFiles();
      const file = files.find(f => f.id === fileId);

      if (!file) {
        return res.status(404).send("File not found");
      }

      const url = await getPresignedDownloadUrl(file.key, file.name);

      // Increment download count
      const updatedFile = await storage.incrementDownloadCount(file.id);
      broadcastNewFile(updatedFile);

      res.redirect(url);
    } catch (error) {
      console.error("Link error:", error);
      res.status(500).send("Error generating link");
    }
  });

  // PATCH /api/files/:id - Update file details
  app.patch("/api/files/:id", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const updatedFile = await storage.updateFile(req.params.id, { name });
      if (!updatedFile) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json(updatedFile);
      broadcastNewFile(updatedFile);
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ error: "Failed to update file" });
    }
  });

  // DELETE /api/files/:id - Delete a file
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const fileId = req.params.id;
      const files = await storage.getFiles();
      const file = files.find(f => f.id === fileId);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
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
      await storage.deleteFile(fileId);

      // Broadcast deletion
      broadcastDeleteFile(fileId);

      res.sendStatus(204);
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // POST /api/upload-url - Get presigned URL for direct upload
  app.post("/api/upload-url", async (req, res) => {
    try {
      const { filename, type } = req.body;
      if (!filename || !type) {
        return res.status(400).json({ error: "Filename and type are required" });
      }

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

  // POST /api/files - Upload a new file (Server-side) or Save metadata (Direct)
  app.post("/api/files", upload.single("file"), async (req, res) => {
    try {
      // Case 1: Direct Upload Metadata Sync
      if (req.body.key && req.body.url && req.body.id) {
        const file = await storage.createFile({
          id: req.body.id,
          name: req.body.name,
          key: req.body.key,
          url: req.body.url,
          type: req.body.type,
          size: parseInt(req.body.size),
          category: req.body.category || "other",
        });

        res.json(file);
        broadcastNewFile(file);
        return;
      }

      // Case 2: Legacy Server-side Upload
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const id = randomUUID();
      const ext = req.file.originalname.split(".").pop() || "";
      const key = `uploads/${id}.${ext}`;
      const category = req.body.category || "other";

      // Upload to S3
      const url = await uploadToS3(req.file.buffer, key, req.file.mimetype);

      // Save metadata
      const file = await storage.createFile({
        id,
        name: req.file.originalname,
        key,
        url,
        type: req.file.mimetype,
        size: req.file.size,
        category,
      });

      res.json(file);
      broadcastNewFile(file);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  return httpServer;
}
