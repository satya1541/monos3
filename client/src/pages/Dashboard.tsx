import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { motion } from "framer-motion";
import { Loader2, FileStack, HardDrive, Download, TrendingUp, Clock } from "lucide-react";
import { Link } from "wouter";

interface DashboardStats {
    totalFiles: number;
    totalSize: number;
    totalDownloads: number;
    topDownloaded: { id: string; name: string; downloads: number }[];
    categoryDistribution: { name: string; count: number }[];
    recentFiles: { id: string; name: string; createdAt: string }[];
}

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export default function Dashboard() {
    const { data: stats, isLoading } = useQuery<DashboardStats>({
        queryKey: ["/api/stats"],
    });

    return (
        <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
            <Navigation />

            <div className="container mx-auto px-4 py-24 md:py-40">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-4xl md:text-6xl font-serif tracking-tighter italic uppercase mb-4">
                        Dashboard
                    </h1>
                    <div className="h-px w-12 bg-white/20 mx-auto" />
                </motion.div>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                    </div>
                ) : stats ? (
                    <div className="space-y-12">
                        {/* Stats Grid */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                            <StatCard
                                icon={<FileStack className="w-6 h-6" />}
                                label="Total Files"
                                value={stats.totalFiles.toString()}
                                delay={0}
                            />
                            <StatCard
                                icon={<HardDrive className="w-6 h-6" />}
                                label="Storage Used"
                                value={formatFileSize(stats.totalSize)}
                                delay={0.1}
                            />
                            <StatCard
                                icon={<Download className="w-6 h-6" />}
                                label="Total Downloads"
                                value={stats.totalDownloads.toString()}
                                delay={0.2}
                            />
                        </motion.div>

                        {/* Two Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Top Downloaded */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="border border-white/10 rounded-sm p-6"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <TrendingUp className="w-5 h-5 opacity-50" />
                                    <h2 className="text-xs uppercase tracking-[0.2em] opacity-50">Top Downloaded</h2>
                                </div>
                                <div className="space-y-4">
                                    {stats.topDownloaded.length > 0 ? (
                                        stats.topDownloaded.map((file, i) => (
                                            <div key={file.id} className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-2xl font-serif opacity-30">{i + 1}</span>
                                                    <span className="truncate max-w-[200px]" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                </div>
                                                <span className="text-sm opacity-50">{file.downloads} downloads</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm opacity-30">No downloads yet</p>
                                    )}
                                </div>
                            </motion.div>

                            {/* Category Distribution */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="border border-white/10 rounded-sm p-6"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <FileStack className="w-5 h-5 opacity-50" />
                                    <h2 className="text-xs uppercase tracking-[0.2em] opacity-50">By Category</h2>
                                </div>
                                <div className="space-y-4">
                                    {stats.categoryDistribution.map((cat) => {
                                        const percentage = (cat.count / stats.totalFiles) * 100;
                                        return (
                                            <div key={cat.name} className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="uppercase tracking-widest">{cat.name}</span>
                                                    <span className="opacity-50">{cat.count} files</span>
                                                </div>
                                                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${percentage}%` }}
                                                        transition={{ delay: 0.5, duration: 0.8 }}
                                                        className="h-full bg-white/50"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </div>

                        {/* Recent Files */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="border border-white/10 rounded-sm p-6"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <Clock className="w-5 h-5 opacity-50" />
                                <h2 className="text-xs uppercase tracking-[0.2em] opacity-50">Recent Uploads</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stats.recentFiles.length > 0 ? (
                                    stats.recentFiles.map((file) => (
                                        <Link key={file.id} href="/games">
                                            <span className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors rounded-sm cursor-pointer">
                                                <span className="truncate max-w-[200px]" title={file.name}>
                                                    {file.name}
                                                </span>
                                                <span className="text-xs opacity-50">{formatDate(file.createdAt)}</span>
                                            </span>
                                        </Link>
                                    ))
                                ) : (
                                    <p className="text-sm opacity-30">No files uploaded yet</p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    <div className="text-center py-20 opacity-30">
                        <p className="tracking-widest uppercase text-xs">Failed to load stats</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    delay,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="border border-white/10 rounded-sm p-6 text-center hover:bg-white/5 transition-colors"
        >
            <div className="flex justify-center mb-4 opacity-50">{icon}</div>
            <p className="text-3xl md:text-4xl font-serif mb-2">{value}</p>
            <p className="text-xs uppercase tracking-[0.2em] opacity-50">{label}</p>
        </motion.div>
    );
}
