import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

declare global {
  // Reuse client across HMR reloads.
  var __s3Client: S3Client | undefined;
}

function readEnv(): {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
} {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "auto";
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env",
    );
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function getClient(): S3Client {
  if (globalThis.__s3Client) return globalThis.__s3Client;
  const { endpoint, region, accessKeyId, secretAccessKey } = readEnv();
  globalThis.__s3Client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
  return globalThis.__s3Client;
}

function getBucket(): string {
  return readEnv().bucket;
}

/** Short, URL-safe ~10-char code we store in `tenant_products.item_image_url`. */
export function newImageCode(): string {
  return nanoid(10);
}

function objectKeyFor(code: string): string {
  return `product-images/${code}`;
}

function planogramPreviewKeyFor(code: string): string {
  return `planogram-previews/${code}`;
}

export async function uploadProductImage(
  code: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKeyFor(code),
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteProductImage(code: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: objectKeyFor(code) }),
    );
  } catch {
    // best-effort delete; never fail the calling operation if S3 cleanup fails
  }
}

/** Presigned GET URL — used by the image route handler to redirect the browser. */
export async function presignedImageUrl(code: string, expiresInSec = 300): Promise<string> {
  const client = getClient();
  return await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: objectKeyFor(code) }),
    { expiresIn: expiresInSec },
  );
}

export async function uploadPlanogramPreview(
  code: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: planogramPreviewKeyFor(code),
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deletePlanogramPreview(code: string): Promise<void> {
  try {
    const client = getClient();
    await client.send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: planogramPreviewKeyFor(code) }),
    );
  } catch {
    // best-effort
  }
}

export async function presignedPlanogramPreviewUrl(
  code: string,
  expiresInSec = 300,
): Promise<string> {
  const client = getClient();
  return await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: getBucket(), Key: planogramPreviewKeyFor(code) }),
    { expiresIn: expiresInSec },
  );
}
