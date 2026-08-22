export interface StoredFile {
  url: string;
  fileKey: string;
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
}

/**
 * Replaceable Storage Service Interface.
 * 
 * Current Implementation: LocalStorageService (stores files on local filesystem under /uploads/listings).
 * Future Replacement: S3StorageService or CloudStorageService implementing this exact interface
 * can replace LocalStorageService in dependency injection without altering calling code in handlers/services.
 */
export interface StorageService {
  saveImage(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
    folder?: string,
  ): Promise<StoredFile>;
  deleteImage(fileKeyOrUrl: string): Promise<void>;
}
