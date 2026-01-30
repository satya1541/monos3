import { type File } from "@shared/schema";
import { X, Download, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

interface FilePreviewModalProps {
    file: File | null;
    onClose: () => void;
}

export function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
    if (!file) return null;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");
    const isPdf = file.type === "application/pdf";

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
                <div className="flex flex-col items-center justify-center py-12 gap-6">
                    <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/20 animate-pulse" />
                    </div>
                    <audio src={getPreviewUrl()} controls autoPlay className="w-full max-w-md">
                        Your browser does not support audio playback.
                    </audio>
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
