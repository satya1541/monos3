import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import { Upload, X, FileIcon, Check, Edit2, Save, Trash2, Copy, ExternalLink } from "lucide-react";
import { type File as UploadedFile } from "@shared/schema";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UploadProgress {
    loaded: number;
    total: number;
    speed: number;
    percentage: number;
}

export default function UploadGame() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [category, setCategory] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [totalProgress, setTotalProgress] = useState<number>(0);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState("");
    const [maxDownloads, setMaxDownloads] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [tags, setTags] = useState("");
    const [parentId, setParentId] = useState("");
    const [pin, setPin] = useState("");
    const [maxDownloadsPerUser, setMaxDownloadsPerUser] = useState("");

    // Previous files query
    const { data: previousFiles } = useQuery<UploadedFile[]>({
        queryKey: ["/api/files"],
    });

    const uploadFile = async (file: File, category: string, contentType: string, onProgress: (loaded: number) => void) => {
        return new Promise((resolve, reject) => {
            // 1. Get Presigned URL
            fetch("/api/upload-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, type: contentType }),
            })
                .then(res => res.json())
                .then(async (data) => {
                    const { url, key, id } = data;

                    // 2. Upload to S3 directly
                    const xhr = new XMLHttpRequest();
                    let startTime = Date.now();

                    xhr.upload.addEventListener("progress", (event) => {
                        if (event.lengthComputable) {
                            onProgress(event.loaded);
                        }
                    });

                    xhr.addEventListener("load", async () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            // 3. Sync Metadata
                            try {
                                // Construct the public URL manually or use the one from server if provided (though server usually gives key/id)
                                // We need the final public URL. Implementation detail:
                                // The server knows the bucket structure. We can send the key back and server reconstructs URL, 
                                // or server sends publicUrl in step 1.
                                // Let's assume server reconstructs it from key.
                                // Wait, previous implementation of POST /api/files expects 'url' in body for direct upload case.
                                // Let's modify step 1 to return publicUrl or construct it.
                                // Actually, simpler: Server constructs it.
                                // Let's assume standard S3 URL format or pass it if known.
                                // In this case, let's just pass what we have.

                                const finalPublicUrl = url.split("?")[0]; // Rough approximation for public URL

                                const res = await fetch("/api/files", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        id,
                                        name: file.name,
                                        key,
                                        url: finalPublicUrl, // This might need adjustment based on bucket policy
                                        type: contentType,
                                        size: file.size,
                                        category: category || "other",
                                        isPrivate,
                                        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                                        maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
                                        maxDownloadsPerUser: maxDownloadsPerUser ? parseInt(maxDownloadsPerUser) : null,
                                        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
                                        parentId: parentId || null,
                                        pin: isPrivate ? pin : null,
                                    }),
                                });

                                if (res.ok) {
                                    resolve(await res.json());
                                } else {
                                    reject(new Error("Metadata sync failed"));
                                }
                            } catch (err) {
                                reject(err);
                            }
                        } else {
                            reject(new Error("S3 Upload failed"));
                        }
                    });

                    xhr.addEventListener("error", () => reject(new Error("Network error")));

                    xhr.open("PUT", url);
                    xhr.setRequestHeader("Content-Type", contentType);
                    xhr.send(file);
                })
                .catch(reject);
        });
    };

    const updateMutation = useMutation({
        mutationFn: async ({ id, name }: { id: string; name: string }) => {
            const res = await fetch(`/api/files/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error("Update failed");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Updated", description: "Filename updated successfully." });
            setEditingFileId(null);
            queryClient.invalidateQueries({ queryKey: ["/api/files"] });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update filename.", variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/files/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Delete failed");
        },
        onSuccess: () => {
            toast({ title: "Deleted", description: "File deleted successfully." });
            setDeletingFileId(null);
            queryClient.invalidateQueries({ queryKey: ["/api/files"] });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete file.", variant: "destructive" });
        },
    });

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
            setUploadComplete(false);
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
            setUploadComplete(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedFiles.length === 0) return;

        if (isPrivate && pin && !/^\d{4}$/.test(pin)) {
            toast({ title: "Invalid PIN", description: "PIN must be exactly 4 digits.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        setTotalProgress(0);

        const fileProgresses = new Array(selectedFiles.length).fill(0);
        const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

        try {
            const uploadPromises = selectedFiles.map(async (file, index) => {
                const contentType = file.type || "application/octet-stream";
                return uploadFile(file, category, contentType, (loaded) => {
                    fileProgresses[index] = loaded;
                    const currentTotalLoaded = fileProgresses.reduce((acc, p) => acc + p, 0);
                    setTotalProgress(Math.round((currentTotalLoaded / totalSize) * 100));
                });
            });

            await Promise.all(uploadPromises);

            setUploadComplete(true);
            toast({ title: "Success", description: `${selectedFiles.length} files uploaded successfully.` });
            queryClient.invalidateQueries({ queryKey: ["/api/files"] });

            setTimeout(() => {
                setSelectedFiles([]);
                setCategory("");
                setTotalProgress(0);
                setUploadComplete(false);
                setExpiresAt("");
                setMaxDownloads("");
                setIsPrivate(false);
                setTags("");
                setParentId("");
                setPin("");
                setMaxDownloadsPerUser("");
            }, 2000);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to upload one or more files.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const startEditing = (file: UploadedFile) => {
        setEditingFileId(file.id);
        setEditName(file.name);
    };

    const saveEdit = (id: string) => {
        if (editName.trim()) {
            updateMutation.mutate({ id, name: editName });
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const copyToClipboard = (id: string, name: string) => {
        const url = `${window.location.origin}/link/${id}`;
        navigator.clipboard.writeText(url).then(() => {
            toast({ title: "Copied!", description: `Link for ${name} copied to clipboard.` });
        });
    };

    const formatSpeed = (bytesPerSecond: number) => {
        if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
        if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
            <Navigation />

            <div className="container mx-auto px-4 py-24 md:py-40 max-w-lg">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-4xl md:text-5xl font-serif mb-4 tracking-tighter italic uppercase">Upload</h1>
                    <div className="h-px w-12 bg-white/20 mx-auto" />
                </motion.div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Drag & Drop Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-sm p-12 text-center transition-all duration-300 ${isUploading ? "cursor-default" : "cursor-pointer"
                            } ${isDragging
                                ? "border-white bg-white/5"
                                : selectedFiles.length > 0
                                    ? "border-white/40 bg-white/5"
                                    : "border-white/20 hover:border-white/40"
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={isUploading}
                        />

                        <AnimatePresence mode="wait">
                            {selectedFiles.length > 0 ? (
                                <motion.div
                                    key="files-selected"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex flex-col items-center gap-3"
                                >
                                    {uploadComplete ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                            className="w-12 h-12 rounded-full bg-white flex items-center justify-center"
                                        >
                                            <Check className="w-6 h-6 text-black" />
                                        </motion.div>
                                    ) : (
                                        <div className="flex -space-x-4 mb-2">
                                            {selectedFiles.slice(0, 3).map((_, i) => (
                                                <div key={i} className="w-10 h-10 rounded-sm bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                                    <FileIcon className="w-5 h-5 opacity-50" />
                                                </div>
                                            ))}
                                            {selectedFiles.length > 3 && (
                                                <div className="w-10 h-10 rounded-sm bg-white/20 border border-white/20 flex items-center justify-center backdrop-blur-sm text-[10px] font-bold">
                                                    +{selectedFiles.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="text-center">
                                        <p className="font-medium">
                                            {selectedFiles.length === 1
                                                ? selectedFiles[0].name
                                                : `${selectedFiles.length} files selected`}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))} Total
                                        </p>
                                    </div>
                                    {!isUploading && !uploadComplete && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedFiles([]);
                                                setTotalProgress(0);
                                            }}
                                            className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="no-file"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center gap-3 opacity-50"
                                >
                                    <Upload className="w-10 h-10" />
                                    <p className="text-sm">Drag & drop or click to select</p>
                                    <p className="text-xs text-muted-foreground">Select one or more files to upload</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Progress Bar */}
                    <AnimatePresence>
                        {isUploading && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 overflow-hidden"
                            >
                                <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                        animate={{ x: ["-100%", "100%"] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    />
                                    <motion.div
                                        className="absolute inset-y-0 left-0 bg-white"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${totalProgress}%` }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                    />
                                    <motion.div
                                        className="absolute inset-y-0 w-8 bg-gradient-to-r from-white to-transparent blur-sm"
                                        style={{ left: `calc(${totalProgress}% - 32px)` }}
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 0.8, repeat: Infinity }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono tabular-nums">{totalProgress}%</span>
                                        <span className="opacity-50">•</span>
                                        <span className="font-mono tabular-nums">Batch Upload</span>
                                    </div>
                                    <span className="font-mono tabular-nums">
                                        Processing {selectedFiles.length} files
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-2">
                        <Label htmlFor="category" className="text-xs uppercase tracking-widest opacity-50">
                            Category (optional)
                        </Label>
                        <Input
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="bg-transparent border-white/20 rounded-none focus:border-white transition-colors"
                            placeholder="e.g. Game, Video, Document"
                            disabled={isUploading}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="expiresAt" className="text-xs uppercase tracking-widest opacity-50">
                                Expiration Date (optional)
                            </Label>
                            <Input
                                id="expiresAt"
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="bg-transparent border-white/20 rounded-none focus:border-white transition-colors"
                                disabled={isUploading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxDownloads" className="text-xs uppercase tracking-widest opacity-50">
                                Max Downloads (optional)
                            </Label>
                            <Input
                                id="maxDownloads"
                                type="number"
                                value={maxDownloads}
                                onChange={(e) => setMaxDownloads(e.target.value)}
                                className="bg-transparent border-white/20 rounded-none focus:border-white transition-colors"
                                placeholder="e.g. 100"
                                disabled={isUploading}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="maxDownloadsPerUser" className="text-xs uppercase tracking-widest opacity-50">
                            Max Downloads per User (optional)
                        </Label>
                        <Input
                            id="maxDownloadsPerUser"
                            type="number"
                            value={maxDownloadsPerUser}
                            onChange={(e) => setMaxDownloadsPerUser(e.target.value)}
                            className="bg-transparent border-white/20 rounded-none focus:border-white transition-colors"
                            placeholder="e.g. 1"
                            disabled={isUploading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="tags" className="text-xs uppercase tracking-widest opacity-50">
                            Tags (comma separated)
                        </Label>
                        <Input
                            id="tags"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="bg-transparent border-white/20 rounded-none focus:border-white transition-colors"
                            placeholder="e.g. gaming, trailer, 2024"
                            disabled={isUploading}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsPrivate(!isPrivate)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${isPrivate ? "bg-white" : "bg-white/10"}`}
                            disabled={isUploading}
                        >
                            <motion.div
                                animate={{ x: isPrivate ? 24 : 0 }}
                                className={`absolute inset-y-1 left-1 w-4 h-4 rounded-full ${isPrivate ? "bg-black" : "bg-white/50"}`}
                            />
                        </button>
                        <span className="text-xs uppercase tracking-widest opacity-50">Private File</span>
                    </div>

                    <AnimatePresence>
                        {isPrivate && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2 overflow-hidden"
                            >
                                <Label htmlFor="pin" className="text-xs uppercase tracking-widest opacity-50">
                                    4-Digit Download PIN (optional)
                                </Label>
                                <Input
                                    id="pin"
                                    type="text"
                                    maxLength={4}
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                                    className="bg-transparent border-white/20 rounded-none focus:border-white transition-colors"
                                    placeholder="e.g. 1234"
                                    disabled={isUploading}
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    If set, anyone (including you) will need this PIN to download the file.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-2">
                        <Label htmlFor="parentId" className="text-xs uppercase tracking-widest opacity-50">
                            Previous Version (optional)
                        </Label>
                        <select
                            id="parentId"
                            value={parentId}
                            onChange={(e) => setParentId(e.target.value)}
                            className="w-full bg-black border border-white/20 rounded-none h-12 px-3 text-sm focus:border-white outline-none transition-colors"
                            disabled={isUploading}
                        >
                            <option value="">No previous version</option>
                            {previousFiles?.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground italic">
                            Select an existing file to link this as a newer version.
                        </p>
                    </div>

                    <Button
                        type="submit"
                        disabled={selectedFiles.length === 0 || isUploading || uploadComplete}
                        variant="outline"
                        className="w-full border-white/20 hover:border-white hover:bg-white hover:text-black transition-all duration-500 rounded-none py-6 h-auto text-xs uppercase tracking-[0.3em] font-medium disabled:opacity-30"
                    >
                        {uploadComplete ? (
                            "Uploaded"
                        ) : isUploading ? (
                            <span className="flex items-center gap-2">
                                <motion.span
                                    animate={{ opacity: [1, 0.5, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                >
                                    Uploading {selectedFiles.length} files...
                                </motion.span>
                            </span>
                        ) : (
                            selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : "Upload File"
                        )}
                    </Button>
                </form>

                {/* Previous Uploads Section */}
                {previousFiles && previousFiles.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-20 border-t border-white/10 pt-10"
                    >
                        <h2 className="text-sm uppercase tracking-widest mb-6 opacity-50">Previous Uploads</h2>
                        <div className="space-y-4">
                            {previousFiles.map((file) => (
                                <div key={file.id} className="group flex items-center justify-between p-4 border border-white/5 hover:border-white/20 rounded-sm bg-white/5 transition-all">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <FileIcon className="w-4 h-4 opacity-50 flex-shrink-0" />
                                        {editingFileId === file.id ? (
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="h-8 bg-black border-white/30 focus:border-white"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="text-sm truncate opacity-80 group-hover:opacity-100 transition-opacity">
                                                {file.name}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => copyToClipboard(file.id, file.name)}
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-black rounded-sm transition-all"
                                            title="Copy Link"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                        <a href={`/link/${file.id}`} target="_blank" rel="noreferrer">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-black rounded-sm transition-all"
                                                title="Open Link"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </Button>
                                        </a>
                                        {editingFileId === file.id ? (
                                            <>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => saveEdit(file.id)}
                                                    className="h-8 w-8 hover:bg-white hover:text-black rounded-sm"
                                                >
                                                    <Save className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => setEditingFileId(null)}
                                                    className="h-8 w-8 hover:bg-white hover:text-black rounded-sm"
                                                >
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => startEditing(file)}
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-black rounded-sm transition-all"
                                                title="Edit Name"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </Button>
                                        )}
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => setDeletingFileId(file.id)}
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-sm transition-all"
                                            title="Delete File"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                <AlertDialog open={!!deletingFileId} onOpenChange={() => setDeletingFileId(null)}>
                    <AlertDialogContent className="bg-zinc-950 border-white/10 text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete File?</AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">
                                This action cannot be undone. This will permanently delete the file from storage.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="border-white/10 hover:bg-white/10 hover:text-white rounded-sm">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-red-500 text-white hover:bg-red-600 rounded-sm"
                                onClick={() => {
                                    if (deletingFileId) {
                                        deleteMutation.mutate(deletingFileId);
                                    }
                                }}
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
