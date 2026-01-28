import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type File } from "@shared/schema";
import { Download, FileIcon, FileVideo, FileImage, FileText, Package, Loader2, Copy, Check, Search, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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

const getFileIcon = (type: string) => {
    if (type.startsWith("video/")) return FileVideo;
    if (type.startsWith("image/")) return FileImage;
    if (type.startsWith("text/") || type.includes("pdf") || type.includes("document")) return FileText;
    if (type.includes("android") || type.includes("apk")) return Package;
    return FileIcon;
};

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export default function Games() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [downloadFile, setDownloadFile] = useState<File | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const { data: files, isLoading } = useQuery<File[]>({
        queryKey: ["/api/files"],
    });

    useEffect(() => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "NEW_FILE") {
                const newFile = message.payload;

                queryClient.setQueryData<File[]>(["/api/files"], (oldFiles) => {
                    if (!oldFiles) return [newFile];
                    if (oldFiles.some(f => f.id === newFile.id)) return oldFiles;
                    return [newFile, ...oldFiles];
                });

                toast({
                    title: "New File Uploaded",
                    description: `${newFile.name} was just added.`,
                });
            }
        };

        return () => {
            socket.close();
        };
    }, [queryClient, toast]);

    const handleCopyLink = (file: File) => {
        const url = `${window.location.protocol}//${window.location.host}/link/${file.id}/${encodeURIComponent(file.name)}`;
        navigator.clipboard.writeText(url);
        setCopiedId(file.id);
        toast({
            title: "Link Copied",
            description: "Shareable link copied to clipboard.",
        });
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
            <Navigation />

            <div className="container mx-auto px-4 py-24 md:py-40">
                {/* Search and Filter Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-2xl mx-auto mb-16 group"
                >
                    <div className="relative">
                        <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/50 to-transparent scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-sm py-4 pl-12 pr-4 text-sm focus:outline-none focus:bg-white/10 transition-colors"
                        />
                    </div>
                </motion.div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                    </div>
                ) : files && files.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {files
                            .filter(file => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((file, index) => {
                                const Icon = getFileIcon(file.type);
                                return (
                                    <motion.div
                                        key={file.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.4, delay: index * 0.05 }}
                                        className="group relative border border-white/10 hover:border-white/30 rounded-sm p-4 md:p-6 transition-all duration-300 hover:bg-white/5"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-white/5 rounded-sm group-hover:bg-white/10 transition-colors">
                                                <Icon className="w-6 h-6 opacity-70" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium truncate mb-1" title={file.name}>
                                                    {file.name}
                                                </h3>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>{formatFileSize(file.size)}</span>
                                                    {file.category && (
                                                        <>
                                                            <span className="opacity-30">•</span>
                                                            <span className="uppercase tracking-widest opacity-70">{file.category}</span>
                                                        </>
                                                    )}
                                                    <span className="opacity-30">•</span>
                                                    <span className="opacity-70">{file.downloadCount} downloads</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute bottom-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <Button
                                                onClick={() => handleCopyLink(file)}
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 border-white/20 hover:border-white hover:bg-white hover:text-black rounded-sm transition-all duration-300"
                                                title="Copy Link"
                                            >
                                                {copiedId === file.id ? (
                                                    <Check className="w-4 h-4" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button
                                                onClick={() => setDownloadFile(file)}
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 border-white/20 hover:border-white hover:bg-white hover:text-black rounded-sm transition-all duration-300"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                    </motion.div>
                ) : (
                    <div className="text-center py-20 opacity-30">
                        <p className="tracking-widest uppercase text-xs">No files uploaded yet</p>
                    </div>
                )}
            </div>

            <AlertDialog open={!!downloadFile} onOpenChange={() => setDownloadFile(null)}>
                <AlertDialogContent className="bg-zinc-950 border-white/10 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Download File?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Are you sure you want to download <span className="text-white font-medium">{downloadFile?.name}</span>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 hover:bg-white/10 hover:text-white rounded-sm">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-white text-black hover:bg-white/90 rounded-sm"
                            onClick={() => {
                                if (downloadFile) {
                                    window.location.href = `/api/files/${downloadFile.id}/download`;
                                }
                                setDownloadFile(null);
                            }}
                        >
                            Download
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
