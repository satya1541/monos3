import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { type File } from "@shared/schema";
import { Download, FileIcon, FileVideo, FileImage, FileText, Package, Loader2, Copy, Check, Search, Eye, Trash2, FolderEdit, Lock, History, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/AuthProvider";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { FilePreviewModal } from "@/components/FilePreviewModal";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [downloadFile, setDownloadFile] = useState<File | null>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [versionFileId, setVersionFileId] = useState<string | null>(null);
    const [pinInput, setPinInput] = useState("");

    const { data: files, isLoading } = useQuery<File[]>({
        queryKey: ["/api/files"],
    });

    const { data: versions } = useQuery<File[]>({
        queryKey: [`/api/files/${versionFileId}/versions`],
        enabled: !!versionFileId,
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
            } else if (message.type === "UPDATE_FILE") {
                const updatedFile = message.payload;
                queryClient.setQueryData<File[]>(["/api/files"], (oldFiles) => {
                    if (!oldFiles) return [updatedFile];
                    return oldFiles.map(f => f.id === updatedFile.id ? updatedFile : f);
                });
            } else if (message.type === "DELETE_FILE") {
                queryClient.setQueryData<File[]>(["/api/files"], (oldFiles) => {
                    if (!oldFiles) return [];
                    return oldFiles.filter(f => f.id !== message.payload.id);
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


    const filteredFiles = files?.filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
            <Navigation />

            <div className="container mx-auto px-4 py-24 md:py-32">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full md:w-64"
                    >
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground transition-colors group-focus-within:text-white" />
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-sm py-2 pl-10 pr-4 text-[10px] uppercase tracking-wider focus:outline-none focus:bg-white/10 focus:border-white/30 transition-all font-medium"
                            />
                        </div>
                    </motion.div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                    </div>
                ) : filteredFiles && filteredFiles.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {filteredFiles.map((file, index) => {
                            const Icon = getFileIcon(file.type);
                            return (
                                <motion.div
                                    key={file.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, delay: index * 0.05 }}
                                    className="group relative border border-white/10 rounded-sm p-4 md:p-6 transition-all duration-300 hover:bg-white/5 hover:border-white/30"
                                >
                                    <div className="flex items-start gap-4 pr-32">
                                        <div className="p-3 bg-white/5 rounded-sm group-hover:bg-white/10 transition-colors">
                                            <Icon className="w-6 h-6 opacity-70" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium truncate mb-1" title={file.name}>
                                                {file.name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <span>{formatFileSize(file.size)}</span>
                                                {file.category && (
                                                    <>
                                                        <span className="opacity-30">•</span>
                                                        <span className="uppercase tracking-widest opacity-70">{file.category}</span>
                                                    </>
                                                )}
                                                <span className="opacity-30">•</span>
                                                <span className="opacity-70">{file.downloadCount} ds</span>

                                                {file.isPrivate && (
                                                    <Badge variant="outline" className="text-[9px] h-4 border-white/20 px-1 py-0 uppercase tracking-tighter ml-1">
                                                        <Lock className="w-2 h-2 mr-1" /> Private
                                                    </Badge>
                                                )}

                                                {file.pin && (
                                                    <Badge variant="outline" className="text-[9px] h-4 border-white/20 px-1 py-0 uppercase tracking-tighter ml-1">
                                                        <Check className="w-2 h-2 mr-1" /> PIN Protected
                                                    </Badge>
                                                )}

                                                {file.expiresAt && new Date(file.expiresAt).getTime() < Date.now() && (
                                                    <Badge variant="destructive" className="text-[9px] h-4 px-1 py-0 uppercase tracking-tighter">
                                                        Expired
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-4px] group-hover:translate-y-0">
                                        <Button
                                            onClick={() => setVersionFileId(file.id)}
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 border-white/10 hover:border-white hover:bg-white hover:text-black rounded-sm transition-all duration-300 bg-black/40 backdrop-blur-sm"
                                            title="Version History"
                                        >
                                            <History className="w-4 h-4" />
                                        </Button>
                                        {(!file.isPrivate && !file.pin) && (
                                            <Button
                                                onClick={() => setPreviewFile(file)}
                                                variant="outline"
                                                size="icon"
                                                className="h-8 w-8 border-white/10 hover:border-white hover:bg-white hover:text-black rounded-sm transition-all duration-300 bg-black/40 backdrop-blur-sm"
                                                title="Preview"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => handleCopyLink(file)}
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 border-white/10 hover:border-white hover:bg-white hover:text-black rounded-sm transition-all duration-300 bg-black/40 backdrop-blur-sm"
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
                                            className="h-8 w-8 border-white/10 hover:border-white hover:bg-white hover:text-black rounded-sm transition-all duration-300 bg-black/40 backdrop-blur-sm"
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
                        <p className="tracking-widest uppercase text-xs">No files found</p>
                    </div>
                )}
            </div>

            {/* File Preview Modal */}
            <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />

            {/* Download Confirmation Dialog */}
            <AlertDialog open={!!downloadFile} onOpenChange={() => setDownloadFile(null)}>
                <AlertDialogContent className="bg-zinc-950 border-white/10 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Download File?</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            {downloadFile?.pin
                                ? "This file is PIN protected. Please enter the 4-digit PIN to download."
                                : `Are you sure you want to download ${downloadFile?.name}?`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {downloadFile?.pin && (
                        <div className="py-4 space-y-2">
                            <Label htmlFor="pin" className="text-xs uppercase tracking-widest opacity-50">
                                Enter 4-Digit PIN
                            </Label>
                            <Input
                                id="pin"
                                type="password"
                                maxLength={4}
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                                className="bg-transparent border-white/20 rounded-none focus:border-white transition-colors"
                                placeholder="****"
                                autoFocus
                            />
                        </div>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            className="border-white/10 hover:bg-white/10 hover:text-white rounded-sm"
                            onClick={() => setPinInput("")}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-white text-black hover:bg-white/90 rounded-sm"
                            disabled={!!(downloadFile?.pin && pinInput.length !== 4)}
                            onClick={() => {
                                if (downloadFile) {
                                    if (downloadFile.pin && pinInput !== downloadFile.pin) {
                                        toast({ title: "Incorrect PIN", description: "The PIN you entered is incorrect.", variant: "destructive" });
                                        return;
                                    }
                                    const pinParam = downloadFile.pin ? `?pin=${pinInput}` : "";
                                    window.location.href = `/api/files/${downloadFile.id}/download${pinParam}`;
                                    toast({
                                        title: "Download Started",
                                        description: `Preparing ${downloadFile.name}...`,
                                    });
                                }
                                setDownloadFile(null);
                                setPinInput("");
                            }}
                        >
                            Download
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Versions Dialog */}
            <AlertDialog open={!!versionFileId} onOpenChange={() => setVersionFileId(null)}>
                <AlertDialogContent className="bg-zinc-950 border-white/10 text-white max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <History className="w-5 h-5" />
                            Version History
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Previous versions and history for this file.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-4 max-h-[50vh] overflow-y-auto">
                        {versions && versions.length > 0 ? (
                            versions.map((v, i) => (
                                <div key={v.id} className="flex items-center justify-between p-3 border border-white/5 rounded-sm bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs font-mono opacity-30">v{versions.length - i}</div>
                                        <div>
                                            <div className="text-sm font-medium">{v.name}</div>
                                            <div className="text-[10px] opacity-50 flex items-center gap-2">
                                                <Clock className="w-2 h-2" />
                                                {new Date(v.createdAt || "").toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 hover:bg-white hover:text-black"
                                        onClick={() => {
                                            window.location.href = `/api/files/${v.id}/download`;
                                            toast({
                                                title: "Download Started",
                                                description: `Preparing version v${versions.length - i} of ${v.name}...`,
                                            });
                                        }}
                                    >
                                        Download
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 opacity-30 italic text-sm">No version history found.</div>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogAction className="bg-white text-black hover:bg-white/90 rounded-sm">Close</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
