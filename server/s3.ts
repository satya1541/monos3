import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./config";

const s3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: !!env.S3_ENDPOINT, // Required for non-AWS S3
});

const BUCKET_NAME = env.S3_BUCKET_NAME;

export async function getPresignedDownloadUrl(
    key: string,
    filename?: string,
    inline: boolean = false
): Promise<string> {
    // Security: Force attachment for risky file types to prevent Stored XSS
    // Even if 'inline' is requested (e.g. for preview), we must not serve HTML/SVG inline
    if (filename && inline) {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext && ['html', 'htm', 'svg', 'xml', 'xhtml'].includes(ext)) {
            inline = false;
        }
    }

    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ResponseContentDisposition: filename
            ? `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
            : undefined,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 minutes for enhanced security
}

export async function getPresignedUploadUrl(
    key: string,
    contentType: string
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}

export async function deleteFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command);
}
