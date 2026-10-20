import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const requiredStorageKeys = [
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY_ID',
  'OBJECT_STORAGE_SECRET_ACCESS_KEY',
] as const;

let cachedClient: S3Client | undefined;

export function isObjectStorageConfigured() {
  return requiredStorageKeys.every((key) => Boolean(process.env[key]));
}

function getClient() {
  if (!isObjectStorageConfigured()) {
    throw new Error('Private object storage is not configured.');
  }
  if (!cachedClient) {
    const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
    cachedClient = new S3Client({
      region: process.env.OBJECT_STORAGE_REGION || 'us-east-1',
      endpoint,
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY!,
      },
    });
  }
  return cachedClient;
}

const bucket = () => process.env.OBJECT_STORAGE_BUCKET!;

export function makeEvidenceObjectKey(orderId: string, fileId: string, extension: string) {
  return `orders/${orderId}/evidence/${fileId}.${extension}`;
}

export function signEvidenceUpload(objectKey: string, contentType: string) {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: bucket(), Key: objectKey, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

export function signEvidenceRead(objectKey: string) {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket(), Key: objectKey }),
    { expiresIn: 120 },
  );
}

export async function verifyEvidenceObject(objectKey: string) {
  const result = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: objectKey }));
  const prefixResult = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: objectKey, Range: 'bytes=0-15' }));
  const prefix = Buffer.from(await prefixResult.Body?.transformToByteArray() || []);
  const contentType = result.ContentType || '';
  const isJpeg = contentType === 'image/jpeg' && prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff;
  const isPng = contentType === 'image/png' && prefix.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = contentType === 'image/webp' && prefix.length >= 12 && prefix.toString('ascii', 0, 4) === 'RIFF' && prefix.toString('ascii', 8, 12) === 'WEBP';
  return { byteSize: Number(result.ContentLength || 0), contentType, validSignature: isJpeg || isPng || isWebp };
}

export async function deleteEvidenceObject(objectKey: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey }));
}
