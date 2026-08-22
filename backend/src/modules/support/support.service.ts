import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "../../config/env.js";
import { isDuplicateEntry } from "../../database/pool.js";
import { AppError } from "../../shared/AppError.js";
import { createReference } from "../../shared/reference.js";
import type { SupportEnquiryInput } from "./support.schemas.js";
import type { SupportRepository } from "./support.repository.js";
import {
  supportRepository,
  type DownloadableAttachment,
  type StoredAttachment,
} from "./support.repository.js";
import {
  sendSupportAdminNotificationEmail,
  sendSupportSubmitterConfirmationEmail,
} from "./support.email.js";

const extensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
};

const signatures: Record<string, readonly number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
};

const supportKeyPattern = /^support_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|pdf)$/i;

function supportStorageDir(): string {
  return path.resolve(process.cwd(), env.PRIVATE_UPLOAD_DIR, "support");
}

function resolveSupportAttachment(key: string): string {
  if (!supportKeyPattern.test(key)) {
    throw new AppError(422, "INVALID_ATTACHMENT_KEY", "The stored attachment reference is invalid.");
  }
  const root = supportStorageDir();
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new AppError(422, "INVALID_ATTACHMENT_KEY", "The stored attachment reference is invalid.");
  }
  return resolved;
}

function hasExpectedSignature(file: Express.Multer.File): boolean {
  const signature = signatures[file.mimetype];
  return Boolean(
    signature?.every((byte, index) => file.buffer[index] === byte),
  );
}

export class SupportService {
  constructor(private readonly repository: SupportRepository) {}

  async create(input: SupportEnquiryInput, userId: number | undefined, file?: Express.Multer.File) {
    const attachment = file ? await this.saveAttachment(file) : null;
    
    let attempts = 0;
    while (attempts < 3) {
      const reference = createReference("SUP");
      try {
        await this.repository.create(reference, input, userId, attachment);

        // Fire-and-forget email notifications (failures must never throw or affect API response)
        Promise.all([
          sendSupportSubmitterConfirmationEmail(reference, input),
          sendSupportAdminNotificationEmail(reference, input, Boolean(attachment)),
        ]).catch((err) => {
          console.error("Failed to dispatch support emails:", err);
        });

        return { reference };
      } catch (error) {
        attempts++;
        if (isDuplicateEntry(error) && attempts < 3) {
          continue; // Retry with a new reference
        }
        
        if (attachment) await fs.rm(resolveSupportAttachment(attachment.key), { force: true });
        throw error;
      }
    }
    // Fallback if loop ends without returning or throwing (shouldn't happen with the logic above)
    if (attachment) await fs.rm(resolveSupportAttachment(attachment.key), { force: true });
    throw new Error("Failed to generate a unique support reference after 3 attempts.");
  }

  list() {
    return this.repository.list();
  }

  listByUser(userId: number, email?: string, role?: string) {
    return this.repository.listByUser(userId, email, role);
  }

  async updateStatus(id: number, status: string) {
    const enquiry = await this.repository.getById(id);
    if (!enquiry) {
      throw new AppError(404, "ENQUIRY_NOT_FOUND", "Support enquiry not found.");
    }
    await this.repository.updateStatus(id, status);
    return { id, status };
  }

  async getAttachment(id: number): Promise<DownloadableAttachment> {
    const attachment = await this.repository.getAttachmentById(id);
    if (!attachment) {
      throw new AppError(404, "ENQUIRY_NOT_FOUND", "Support enquiry or its attachment could not be found.");
    }
    const filePath = resolveSupportAttachment(attachment.key);
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch {
      throw new AppError(404, "ATTACHMENT_NOT_FOUND", "The requested attachment file no longer exists.");
    }
    return { path: filePath, name: attachment.name, mime: attachment.mime };
  }

  private async saveAttachment(file: Express.Multer.File): Promise<StoredAttachment> {
    // MIME headers are browser-supplied, so verify the actual leading bytes too.
    if (!hasExpectedSignature(file)) {
      throw new AppError(
        422,
        "UPLOAD_VALIDATION_ERROR",
        "The attachment content does not match its JPG, PNG or PDF file type.",
      );
    }
    const directory = supportStorageDir();
    await fs.mkdir(directory, { recursive: true });
    const filename = `support_${randomUUID()}${extensions[file.mimetype] ?? ""}`;
    const destination = resolveSupportAttachment(filename);
    await fs.writeFile(destination, file.buffer, { flag: "wx" });
    const safeOriginalName = file.originalname
      .split(/[\\/]/)
      .pop()!
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 255) || "attachment";
    return { key: filename, name: safeOriginalName, mime: file.mimetype };
  }
}

export const supportService = new SupportService(supportRepository);
