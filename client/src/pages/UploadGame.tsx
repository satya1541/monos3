import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import { Upload, X, FileIcon, Check, Edit2, Save, Trash2 } from "lucide-react";
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
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [category, setCategory] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

    // Previous files query
    const { data: previousFiles } = useQuery<UploadedFile[]>({
        queryKey: ["/api/files"],
    });

    const uploadFile = async (file: File, category: string) => {
        return new Promise((resolve, reject) => {
            // 1. Get Presigned URL
            fetch("/api/upload-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, type: file.type }),
            })
                .then(res => res.json())
                .then(async (data) => {
                    const { url, key, id } = data;

                    // 2. Upload to S3 directly
                    const xhr = new XMLHttpRequest();
                    let startTime = Date.now();

                    xhr.upload.addEventListener("progress", (event) => {
                        if (event.lengthComputable) {
                            const now = Date.now();
                            const elapsed = (now - startTime) / 1000;
                            const speed = elapsed > 0 ? event.loaded / elapsed : 0;

                            setProgress({
                                loaded: event.loaded,
                                total: event.total,
                                speed,
                                percentage: Math.round((event.loaded / event.total) * 100),
                            });
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
                                        type: file.type,
                                        size: file.size,
                                        category: category || "other",
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
                    xhr.setRequestHeader("Content-Type", file.type);
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            setSelectedFile(files[0]);
            setUploadComplete(false);
        }
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setSelectedFile(files[0]);
            setUploadComplete(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        setIsUploading(true);
        setProgress({ loaded: 0, total: selectedFile.size, speed: 0, percentage: 0 });

        try {
            await uploadFile(selectedFile, category);
            setUploadComplete(true);
            toast({ title: "Success", description: "File uploaded successfully." });
            queryClient.invalidateQueries({ queryKey: ["/api/files"] });

            setTimeout(() => {
                setSelectedFile(null);
                setCategory("");
                setProgress(null);
                setUploadComplete(false);
            }, 2000);
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to upload file.", variant: "destructive" });
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
                                : selectedFile
                                    ? "border-white/40 bg-white/5"
                                    : "border-white/20 hover:border-white/40"
                            }`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                            disabled={isUploading}
                        />

                        <AnimatePresence mode="wait">
                            {selectedFile ? (
                                <motion.div
                                    key="file-selected"
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
                                        <FileIcon className="w-10 h-10 opacity-50" />
                                    )}
                                    <div>
                                        <p className="font-medium truncate max-w-[250px]">{selectedFile.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatFileSize(selectedFile.size)}
                                        </p>
                                    </div>
                                    {!isUploading && !uploadComplete && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedFile(null);
                                                setProgress(null);
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
                                    <p className="text-xs text-muted-foreground">APK, Video, Image, or any file</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Progress Bar */}
                    <AnimatePresence>
                        {progress && isUploading && (
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
                                        animate={{ width: `${progress.percentage}%` }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                    />
                                    <motion.div
                                        className="absolute inset-y-0 w-8 bg-gradient-to-r from-white to-transparent blur-sm"
                                        style={{ left: `calc(${progress.percentage}% - 32px)` }}
                                        animate={{ opacity: [0.5, 1, 0.5] }}
                                        transition={{ duration: 0.8, repeat: Infinity }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono tabular-nums">{progress.percentage}%</span>
                                        <span className="opacity-50">•</span>
                                        <span className="font-mono tabular-nums">{formatSpeed(progress.speed)}</span>
                                    </div>
                                    <span className="font-mono tabular-nums">
                                        {formatFileSize(progress.loaded)} / {formatFileSize(progress.total)}
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

                    <Button
                        type="submit"
                        disabled={!selectedFile || isUploading || uploadComplete}
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
                                    Uploading...
                                </motion.span>
                            </span>
                        ) : (
                            "Upload File"
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
