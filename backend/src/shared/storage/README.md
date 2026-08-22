# Pluggable Storage Service Architecture

## Purpose
Provides an abstracted storage service interface (`StorageService`) separating business logic from file storage mechanisms. The default implementation stores files on local disk under `/uploads/listings/`, but can be replaced with cloud object storage (e.g. AWS S3, Google Cloud Storage, or Cloudflare R2) without modifying calling controllers or services.

## Files
* `storage.interface.ts`: `StorageService` interface defining `saveImage()` and `deleteImage()` signatures.
* `localStorage.service.ts`: Disk-backed implementation for local development and hosting environments.

## Object Storage (S3 / GCS) Extension Guide
To swap local disk storage for AWS S3 or compatible object storage in production:

1. Install S3 client SDK (`@aws-sdk/client-s3`).
2. Create `s3Storage.service.ts` implementing `StorageService`:
   ```ts
   import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
   import type { StorageService, StoredFile } from "./storage.interface.js";

   export class S3StorageService implements StorageService {
     private s3 = new S3Client({ region: process.env.AWS_REGION });

     async saveImage(buffer: Buffer, originalFilename: string, mimeType: string, folder = "listings"): Promise<StoredFile> {
       const fileKey = `${folder}/${crypto.randomUUID()}${path.extname(originalFilename)}`;
       await this.s3.send(new PutObjectCommand({
         Bucket: process.env.S3_BUCKET_NAME,
         Key: fileKey,
         Body: buffer,
         ContentType: mimeType,
       }));
       const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
       return { url, fileKey, mimeType, size: buffer.length };
     }

     async deleteImage(fileKeyOrUrl: string): Promise<void> {
       const Key = fileKeyOrUrl.replace(/^https:\/\/.*?\//, "");
       await this.s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key }));
     }
   }
   ```
3. Export an instance based on environment variables:
   ```ts
   export const storageService = process.env.STORAGE_PROVIDER === "s3"
     ? new S3StorageService()
     : new LocalStorageService();
   ```
4. Calling code consumes `storageService` with zero signature changes.
