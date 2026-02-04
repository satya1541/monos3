import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
    DATABASE_HOST: z.string(),
    DATABASE_PORT: z.string().transform((v) => parseInt(v, 10)).default("3306"),
    DATABASE_USER: z.string(),
    DATABASE_PASSWORD: z.string(),
    DATABASE_NAME: z.string(),
    S3_REGION: z.string().default("us-east-1"),
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
    S3_BUCKET_NAME: z.string(),
    PORT: z.string().transform((v) => parseInt(v, 10)).default("5000"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SESSION_SECRET: z.string().default("mono-s3-file-secret-key-change-in-production"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error("❌ Invalid environment variables:", _env.error.format());
    process.exit(1);
}

if (_env.data.NODE_ENV === "production" && _env.data.SESSION_SECRET === "mono-s3-file-secret-key-change-in-production") {
    console.warn("⚠️ WARNING: Running in production with default SESSION_SECRET. This is insecure!");
}

export const env = _env.data;
