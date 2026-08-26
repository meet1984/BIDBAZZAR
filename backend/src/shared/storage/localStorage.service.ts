import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "../AppError.js";
import type { StorageService, StoredFile } from "./storage.interface.js";
import { env } from "../../config/env.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export class LocalStorageService implements StorageService {
  private readonly baseUploadDir: string;
  private readonly baseUrlPrefix: string;

  constructor(baseUploadDir = env.UPLOAD_DIR, baseUrlPrefix = "/uploads") {
    this.baseUploadDir = path.resolve(process.cwd(), baseUploadDir);
    this.baseUrlPrefix = baseUrlPrefix;
  }

  private async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async saveImage(
    buffer: Buffer,
    _originalFilename: string,
    mimeType: string,
    folder = "listings",
  ): Promise<StoredFile> {
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new AppError(
        422,
        "INVALID_IMAGE_TYPE",
        "Only JPG, PNG, and WebP image files are allowed.",
      );
    }

    if (buffer.length > env.MAX_UPLOAD_BYTES) {
      throw new AppError(
        422,
        "FILE_TOO_LARGE",
        `Image file size cannot exceed ${Math.floor(env.MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
      );
    }

    if (!hasValidImageSignature(buffer, mimeType.toLowerCase())) {
      throw new AppError(422, "INVALID_IMAGE_CONTENT", "The file content does not match the declared image type.");
    }

    if (!/^[a-z0-9_-]+$/i.test(folder)) {
      throw new AppError(422, "INVALID_STORAGE_FOLDER", "The image storage folder is invalid.");
    }
    const folderPath = path.resolve(this.baseUploadDir, folder);
    if (!folderPath.startsWith(`${this.baseUploadDir}${path.sep}`)) {
      throw new AppError(422, "INVALID_STORAGE_FOLDER", "The image storage folder is invalid.");
    }
    await this.ensureDir(folderPath);

    const ext = EXTENSIONS[mimeType.toLowerCase()]!;

    // Generate safe, non-guessable filename
    const safeUUID = crypto.randomUUID();
    const filename = `${safeUUID}${ext}`;
    const filePath = path.join(folderPath, filename);

    await fs.writeFile(filePath, buffer, { flag: "wx" });

    const relativeKey = `${folder}/${filename}`;
    const url = `${this.baseUrlPrefix}/${relativeKey}`;

    return {
      url,
      fileKey: relativeKey,
      mimeType,
      size: buffer.length,
      thumbnailUrl: url, // Local storage uses exact asset URL as thumbnail
    };
  }

  async deleteImage(fileKeyOrUrl: string): Promise<void> {
    if (!fileKeyOrUrl) return;

    let relativePath = fileKeyOrUrl;
    if (fileKeyOrUrl.startsWith("/api/uploads")) {
      relativePath = fileKeyOrUrl.slice("/api/uploads".length).replace(/^\/+/, "");
    } else if (fileKeyOrUrl.startsWith(this.baseUrlPrefix)) {
      relativePath = fileKeyOrUrl.slice(this.baseUrlPrefix.length).replace(/^\/+/, "");
    }

    const fullPath = path.resolve(this.baseUploadDir, relativePath);
    if (!fullPath.startsWith(`${this.baseUploadDir}${path.sep}`)) {
      throw new AppError(422, "INVALID_FILE_KEY", "The image storage reference is invalid.");
    }
    try {
      await fs.unlink(fullPath);
    } catch (err: unknown) {
      // Ignore if file doesn't exist on disk during cleanup
      if ((err as { code?: string })?.code !== "ENOENT") {
        throw err;
      }
    }
  }
}

export const localStorageService = new LocalStorageService();
