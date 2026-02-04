import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetAt: number;
    };
}

const stores: { [key: string]: RateLimitStore } = {};

export function createRateLimiter(options: {
    windowMs: number;
    max: number;
    message: string;
}) {
    const { windowMs, max, message } = options;
    const store: RateLimitStore = {};

    return (req: Request, res: Response, next: NextFunction) => {
        const key = req.ip || "unknown";
        const now = Date.now();

        if (!store[key] || now > store[key].resetAt) {
            store[key] = {
                count: 1,
                resetAt: now + windowMs,
            };
            return next();
        }

        store[key].count++;

        if (store[key].count > max) {
            return res.status(429).json({ error: message });
        }

        next();
    };
}
