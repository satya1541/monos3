import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

interface User {
    id: string;
    username: string;
    displayName: string | null;
    role: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    register: (username: string, password: string, displayName?: string) => Promise<boolean>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    // Initialize from localStorage for immediate UI responsiveness
    const [user, setUser] = useState<User | null>(() => {
        const saved = localStorage.getItem("mono_auth_user");
        try {
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Check if user is logged in on mount (verify session with server)
    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => {
                if (!res.ok) throw new Error("Not authenticated");
                return res.json();
            })
            .then((data) => {
                setUser(data);
                localStorage.setItem("mono_auth_user", JSON.stringify(data));
                setIsLoading(false);
            })
            .catch(() => {
                setUser(null);
                localStorage.removeItem("mono_auth_user");
                setIsLoading(false);
            });
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                localStorage.setItem("mono_auth_user", JSON.stringify(userData));
                toast({ title: "Welcome back!", description: `Logged in as ${userData.displayName || userData.username}` });
                return true;
            } else {
                const error = await res.json();
                toast({ title: "Login failed", description: error.error, variant: "destructive" });
                return false;
            }
        } catch {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
            return false;
        }
    };

    const register = async (username: string, password: string, displayName?: string): Promise<boolean> => {
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, displayName }),
            });

            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                localStorage.setItem("mono_auth_user", JSON.stringify(userData));
                toast({ title: "Welcome!", description: "Account created successfully" });
                return true;
            } else {
                const error = await res.json();
                toast({ title: "Registration failed", description: error.error, variant: "destructive" });
                return false;
            }
        } catch {
            toast({ title: "Error", description: "Network error", variant: "destructive" });
            return false;
        }
    };

    const logout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            setUser(null);
            localStorage.removeItem("mono_auth_user");
            toast({ title: "Logged out", description: "See you next time!" });
        } catch {
            toast({ title: "Error", description: "Logout failed", variant: "destructive" });
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
