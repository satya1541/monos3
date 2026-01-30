import { useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, User, Lock, UserPlus } from "lucide-react";
import streetBg from "@/assets/street.png";

export default function Login() {
    const { login, register, isLoading: authLoading } = useAuth();
    const [, setLocation] = useLocation();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        let success = false;
        if (mode === "login") {
            success = await login(username, password);
        } else {
            success = await register(username, password, displayName);
        }

        setIsSubmitting(false);
        if (success) {
            setLocation("/");
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background Image */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 grayscale"
                style={{ backgroundImage: `url(${streetBg})` }}
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/80 via-black/40 to-black/80" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md relative z-20"
            >
                {/* Header */}
                <div className="text-center mb-10">
                    <motion.h1
                        className="text-4xl md:text-5xl font-serif tracking-tighter italic uppercase mb-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        {mode === "login" ? "Welcome Back" : "Join Us"}
                    </motion.h1>
                    <div className="h-px w-12 bg-white/40 mx-auto" />
                </div>

                {/* Mode Toggle */}
                <div className="flex justify-center gap-4 mb-8">
                    <button
                        onClick={() => setMode("login")}
                        className={`px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all font-bold ${mode === "login"
                            ? "text-white border-b-2 border-white"
                            : "text-white/40 hover:text-white/60"
                            }`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setMode("register")}
                        className={`px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all font-bold ${mode === "register"
                            ? "text-white border-b-2 border-white"
                            : "text-white/40 hover:text-white/60"
                            }`}
                    >
                        Register
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <AnimatePresence mode="wait">
                        {mode === "register" && (
                            <motion.div
                                key="displayName"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2"
                            >
                                <Label htmlFor="displayName" className="text-xs uppercase tracking-widest font-bold opacity-80 text-white">
                                    Display Name
                                </Label>
                                <div className="relative">
                                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                                    <Input
                                        id="displayName"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="bg-white/5 border-white/20 rounded-none pl-10 focus:border-white transition-colors text-white font-medium placeholder:text-white/40"
                                        placeholder="Your display name"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="space-y-2">
                        <Label htmlFor="username" className="text-xs uppercase tracking-widest font-bold opacity-80 text-white">
                            Username
                        </Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="bg-white/5 border-white/20 rounded-none pl-10 focus:border-white transition-colors text-white font-medium placeholder:text-white/40"
                                placeholder="Enter username"
                                required
                                autoComplete="username"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-xs uppercase tracking-widest font-bold opacity-80 text-white">
                            Password
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-white/5 border-white/20 rounded-none pl-10 focus:border-white transition-colors text-white font-medium placeholder:text-white/40"
                                placeholder="Enter password"
                                required
                                minLength={6}
                                autoComplete={mode === "login" ? "current-password" : "new-password"}
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        variant="outline"
                        className="w-full border-white/20 hover:border-white hover:bg-white hover:text-black transition-all duration-500 rounded-none py-6 h-auto text-xs uppercase tracking-[0.3em] font-black disabled:opacity-30"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : mode === "login" ? (
                            "Sign In"
                        ) : (
                            "Create Account"
                        )}
                    </Button>
                </form>

                {/* Back to Home */}
                <div className="mt-8 text-center">
                    <button
                        onClick={() => setLocation("/")}
                        className="text-xs uppercase tracking-widest font-bold text-white/50 hover:text-white transition-colors"
                    >
                        ← Back to Home
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
