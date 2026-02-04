import { type File } from "@shared/schema";
import { X, Download, ExternalLink, FileText, Music, Play, Pause, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

interface FilePreviewModalProps {
    file: File | null;
    onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
    const [codeContent, setCodeContent] = useState<string | null>(null);
    const [loadingCode, setLoadingCode] = useState(false);

    const isImage = file?.type.startsWith("image/");
    const isVideo = file?.type.startsWith("video/");
    const isAudio = file?.type.startsWith("audio/");
    const isPdf = file?.type === "application/pdf";
    const isCode = file?.type.startsWith("text/") ||
        file?.name.endsWith(".js") ||
        file?.name.endsWith(".ts") ||
        file?.name.endsWith(".json") ||
        file?.name.endsWith(".css") ||
        file?.name.endsWith(".html") ||
        file?.name.endsWith(".sql");

    useEffect(() => {
        if (file && isCode) {
            setLoadingCode(true);
            fetch(`/api/files/${file.id}/download?preview=true`)
                .then(res => res.text())
                .then(text => {
                    setCodeContent(text);
                    setLoadingCode(false);
                })
                .catch(err => {
                    console.error("Failed to fetch code content:", err);
                    setLoadingCode(false);
                });
        } else {
            setCodeContent(null);
        }
    }, [file, isCode]);

    if (!file) return null;

    const handleDownload = () => {
        window.location.href = `/api/files/${file.id}/download`;
        onClose();
    };

    const getPreviewUrl = () => {
        // For S3 files, we need to use the download endpoint which generates a presigned URL
        return `/api/files/${file.id}/download?preview=true`;
    };

    const renderPreview = () => {
        if (isImage) {
            return (
                <div className="flex items-center justify-center max-h-[70vh] overflow-hidden">
                    <img
                        src={getPreviewUrl()}
                        alt={file.name}
                        className="max-w-full max-h-[70vh] object-contain rounded-sm"
                        loading="lazy"
                    />
                </div>
            );
        }

        if (isVideo) {
            return (
                <video
                    src={getPreviewUrl()}
                    controls
                    autoPlay
                    className="max-w-full max-h-[70vh] rounded-sm"
                >
                    Your browser does not support video playback.
                </video>
            );
        }

        if (isAudio) {
            return (
                <div className="flex flex-col items-center justify-center py-20 gap-8 bg-white/5 rounded-sm border border-white/10">
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="w-40 h-40 rounded-full bg-gradient-to-br from-white/20 to-transparent flex items-center justify-center shadow-2xl"
                    >
                        <Music className="w-16 h-16 opacity-50" />
                    </motion.div>

                    <div className="w-full max-w-md space-y-4">
                        <div className="flex justify-center gap-1 h-8 items-end">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    animate={{ height: ["20%", "100%", "20%"] }}
                                    transition={{
                                        duration: 0.5 + Math.random(),
                                        repeat: Infinity,
                                        delay: i * 0.05
                                    }}
                                    className="w-1 bg-white/20 rounded-full"
                                />
                            ))}
                        </div>
                        <audio src={getPreviewUrl()} controls autoPlay className="w-full filter invert hue-rotate-180 opacity-80" />
                    </div>
                </div>
            );
        }

        if (isCode) {
            return (
                <div className="relative bg-[#0d0d0d] rounded-sm border border-white/10 font-mono text-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5">
                        <span className="text-[10px] uppercase tracking-widest opacity-50 flex items-center gap-2">
                            <FileText className="w-3 h-3" />
                            Source Code
                        </span>
                        {codeContent && (
                            <span className="text-[10px] opacity-30">{codeContent.length} characters</span>
                        )}
                    </div>
                    {loadingCode ? (
                        null
                    ) : codeContent ? (
                        <pre className="p-6 overflow-auto max-h-[70vh] text-gray-300 selection:bg-white selection:text-black leading-relaxed">
                            <code>{codeContent}</code>
                        </pre>
                    ) : (
                        <div className="p-20 text-center opacity-30 italic">No content available</div>
                    )}
                </div>
            );
        }

        if (isPdf) {
            return (
                <iframe
                    src={getPreviewUrl()}
                    className="w-full h-[70vh] rounded-sm bg-white"
                    title={file.name}
                />
            );
        }

        // Fallback for unsupported types
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-6">
                    <ExternalLink className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-lg mb-2">Preview not available</p>
                <p className="text-sm text-white/50 mb-6">
                    This file type ({file.type}) cannot be previewed in the browser.
                </p>
                <Button
                    onClick={handleDownload}
                    variant="outline"
                    className="border-white/20 hover:border-white hover:bg-white hover:text-black rounded-sm"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                </Button>
            </div>
        );
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", damping: 25 }}
                    className="relative bg-zinc-950 border border-white/10 rounded-sm max-w-5xl w-full max-h-[90vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div className="flex-1 min-w-0 pr-4">
                            <h2 className="text-sm font-medium truncate">{file.name}</h2>
                            <p className="text-xs text-white/50 uppercase tracking-widest mt-1">
                                {file.type}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleDownload}
                                variant="outline"
                                size="sm"
                                className="border-white/20 hover:border-white hover:bg-white hover:text-black rounded-sm text-xs uppercase tracking-widest"
                            >
                                <Download className="w-3 h-3 mr-2" />
                                Download
                            </Button>
                            <Button
                                onClick={onClose}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-white/10"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
                        {renderPreview()}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
