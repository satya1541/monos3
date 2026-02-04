import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { type Express, type Request, type Response, type NextFunction } from "express";
import { db } from "./db";
import { users, type User, insertUserSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { env } from "./config";
import { createRateLimiter } from "./rate-limit";

const authRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Too many authentication attempts, please try again after an hour"
});

const SALT_ROUNDS = 10;

// Configure Passport Local Strategy
passport.use(
    new LocalStrategy(async (username, password, done) => {
        try {
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.username, username.toLowerCase()));

            if (!user) {
                return done(null, false, { message: "Invalid username or password" });
            }

            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                return done(null, false, { message: "Invalid username or password" });
            }

            return done(null, user);
        } catch (error) {
            return done(error);
        }
    })
);

// Serialize user to session
passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
    try {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        done(null, user || null);
    } catch (error) {
        done(error);
    }
});

// Setup authentication middleware
export function setupAuth(app: Express) {
    // Required for secure cookies behind a proxy (like Replit, Heroku, Nginx)
    // Only trust proxy in production to prevent rate-limit bypass in direct deployments
    if (env.NODE_ENV === "production") {
        app.set("trust proxy", 1);
    }

    // Session configuration
    app.use(
        session({
            secret: env.SESSION_SECRET || "mono-s3-file-secret-key-change-in-production",
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: env.NODE_ENV === "production",
                httpOnly: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                sameSite: "lax",
            },
        })
    );

    app.use(passport.initialize());
    app.use(passport.session());
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated()) {
        return next();
    }
    return res.status(401).json({ error: "Unauthorized" });
}

// Middleware to check if user is admin
export function isAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.isAuthenticated() && (req.user as User)?.role === "admin") {
        return next();
    }
    return res.status(403).json({ error: "Forbidden" });
}

// Register auth routes
export function registerAuthRoutes(app: Express) {
    // Register
    app.post("/api/auth/register", authRateLimiter, async (req, res) => {
        try {
            const { username, password, displayName } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: "Username and password are required" });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: "Password must be at least 6 characters" });
            }

            // Check if user exists
            const [existing] = await db
                .select()
                .from(users)
                .where(eq(users.username, username.toLowerCase()));

            if (existing) {
                return res.status(400).json({ error: "Username already exists" });
            }

            // Hash password and create user
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const id = randomUUID();

            await db.insert(users).values({
                id,
                username: username.toLowerCase(),
                password: hashedPassword,
                displayName: displayName || username,
                role: "user",
            });

            const [newUser] = await db.select().from(users).where(eq(users.id, id));

            // Auto-login after registration
            req.login(newUser, (err) => {
                if (err) {
                    return res.status(500).json({ error: "Registration successful but login failed" });
                }
                return res.json({
                    id: newUser.id,
                    username: newUser.username,
                    displayName: newUser.displayName,
                    role: newUser.role,
                });
            });
        } catch (error) {
            console.error("Register error:", error);
            res.status(500).json({ error: "Registration failed" });
        }
    });

    // Login
    app.post("/api/auth/login", authRateLimiter, (req, res, next) => {
        passport.authenticate("local", (err: any, user: User | false, info: any) => {
            if (err) {
                return res.status(500).json({ error: "Authentication error" });
            }
            if (!user) {
                return res.status(401).json({ error: info?.message || "Invalid credentials" });
            }
            req.login(user, (loginErr) => {
                if (loginErr) {
                    return res.status(500).json({ error: "Login failed" });
                }
                return res.json({
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    role: user.role,
                });
            });
        })(req, res, next);
    });

    // Logout
    app.post("/api/auth/logout", (req, res) => {
        req.logout((err) => {
            if (err) {
                return res.status(500).json({ error: "Logout failed" });
            }
            res.json({ message: "Logged out successfully" });
        });
    });

    // Get current user
    app.get("/api/auth/me", (req, res) => {
        if (req.isAuthenticated()) {
            const user = req.user as User;
            return res.json({
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                role: user.role,
            });
        }
        return res.json(null);
    });
}
