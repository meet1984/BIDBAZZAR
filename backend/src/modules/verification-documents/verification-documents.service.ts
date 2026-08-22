import fs from "node:fs/promises";
import { createReadStream, type ReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/AppError.js";
import type { VerificationAccountType, VerificationDocumentRecord } from "../../types/database.types.js";
import { buyerProfileRepository } from "../buyer-profile/buyer-profile.repository.js";
import { sellerProfileRepository } from "../seller-profile/seller-profile.repository.js";
import { verificationRepository } from "../verification/verification.repository.js";
import { verificationDocumentRepository, type VerificationDocumentRepository } from "./verification-documents.repository.js";
import { adminPermissionRepository } from "../admin-permissions/admin-permission.repository.js";
import type { CreateDocumentMetadataInput } from "./verification-documents.schemas.js";

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

export function hasExpectedSignature(file: Express.Multer.File): boolean {
  const signature = signatures[file.mimetype];
  return Boolean(
    signature?.every((byte, index) => file.buffer[index] === byte),
  );
}

const verificationKeyPattern = /^verif_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|pdf)$/i;

function verificationStorageDir(): string {
  return path.resolve(process.cwd(), env.PRIVATE_UPLOAD_DIR, "verification");
}

function resolveVerificationFile(fileKey: string): string {
  if (!verificationKeyPattern.test(fileKey)) {
    throw new AppError(422, "INVALID_FILE_KEY", "The stored document reference is invalid.");
  }
  const root = verificationStorageDir();
  const resolved = path.resolve(root, fileKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new AppError(422, "INVALID_FILE_KEY", "The stored document reference is invalid.");
  }
  return resolved;
}

export interface SafeDocumentDTO {
  id: number;
  documentType: string;
  originalName: string;
  fileMime: string;
  fileSize: number;
  createdAt: string;
}

export function redactDocument(doc: VerificationDocumentRecord): SafeDocumentDTO {
  // STRICT REDACTION: Exclude fileKey, raw disk paths, internal storage keys
  return {
    id: doc.id,
    documentType: doc.documentType,
    originalName: doc.originalName,
    fileMime: doc.fileMime,
    fileSize: doc.fileSize,
    createdAt: doc.createdAt.toISOString(),
  };
}

export interface DownloadStreamResult {
  stream: ReadStream;
  fileMime: string;
  originalName: string;
}

export class VerificationDocumentService {
  constructor(private readonly repository: VerificationDocumentRepository) { }

  async listAccountDocuments(accountId: number, accountType?: VerificationAccountType): Promise<SafeDocumentDTO[]> {
    const docs = await this.repository.findByAccount(accountId, accountType);
    return docs.map(redactDocument);
  }

  async uploadDocumentFile(
    accountId: number,
    accountType: VerificationAccountType,
    input: CreateDocumentMetadataInput,
    file?: Express.Multer.File,
  ): Promise<SafeDocumentDTO> {
    if (!file) {
      throw new AppError(400, "DOCUMENT_REQUIRED", "Choose a JPG, PNG, or PDF document to upload.");
    }

    // 1. Check Magic Byte File Signature
    if (!hasExpectedSignature(file)) {
      throw new AppError(
        422,
        "UPLOAD_VALIDATION_ERROR",
        "The uploaded file content does not match its declared JPG, PNG, or PDF file signature.",
      );
    }

    // 2. Generate Non-Guessable UUID File Key
    const ext = extensions[file.mimetype] || ".bin";
    const fileKey = `verif_${randomUUID()}${ext}`;
    const storageDir = verificationStorageDir();
    await fs.mkdir(storageDir, { recursive: true });
    const targetPath = resolveVerificationFile(fileKey);

    // 3. Save file outside public web directory
    await fs.writeFile(targetPath, file.buffer, { flag: "wx" });

    // 4. Create database record
    const metaInput = {
      documentType: input.documentType,
      originalName: file.originalname.slice(0, 255),
      fileMime: file.mimetype as "image/jpeg" | "image/png" | "application/pdf",
      fileSize: file.size,
    };

    let created: VerificationDocumentRecord;
    try {
      created = await this.repository.create(accountId, accountType, fileKey, metaInput);
    } catch (error) {
      await fs.rm(targetPath, { force: true }).catch(() => undefined);
      throw error;
    }

    if (accountType === "buyer") {
      const profile = await buyerProfileRepository.findByAccountId(accountId);
      if (profile && profile.verificationStatus === "profile_incomplete") {
        await buyerProfileRepository.updateVerificationStatus(accountId, "draft");
      }
    } else if (accountType === "seller") {
      const profile = await sellerProfileRepository.findByAccountId(accountId);
      if (profile && profile.verificationStatus === "profile_incomplete") {
        await sellerProfileRepository.updateVerificationStatus(accountId, "draft");
      }
    }

    await verificationRepository.recordAuditLog(
      accountId,
      accountId,
      accountType,
      "document_uploaded",
      { documentId: created.id, documentType: created.documentType },
    );

    return redactDocument(created);
  }

  async getDocumentFileStream(
    id: number,
    requesterAccountId: number,
    requesterAccountType: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DownloadStreamResult> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document record not found.");
    }

    const isOwner = doc.accountId === requesterAccountId;
    let isAuthorizedAdmin = requesterAccountType === "admin";
    if (!isAuthorizedAdmin && requesterAccountType === "admin_employee") {
      const hasPermission = await adminPermissionRepository.hasPermission(requesterAccountId, "verification_review");
      if (hasPermission) isAuthorizedAdmin = true;
    }

    if (!isOwner && !isAuthorizedAdmin) {
      throw new AppError(403, "ACCESS_DENIED", "You do not have permission to view or download this document.");
    }

    const filePath = resolveVerificationFile(doc.fileKey);

    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch {
      throw new AppError(404, "FILE_NOT_FOUND", "The requested document file could not be found on storage.");
    }

    if (isAuthorizedAdmin && !isOwner) {
      // Log authorized admin access to sensitive document
      await verificationRepository.recordAuditLog(
        requesterAccountId,
        doc.accountId,
        doc.accountType,
        "document_viewed",
        { documentId: doc.id, documentType: doc.documentType },
        ipAddress,
        userAgent,
      );
    }

    const stream = createReadStream(filePath);
    return { stream, fileMime: doc.fileMime, originalName: doc.originalName };
  }

  async deleteDocument(id: number, accountId: number): Promise<void> {
    const doc = await this.repository.findById(id);
    if (!doc || doc.accountId !== accountId) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found or access denied.");
    }

    const filePath = resolveVerificationFile(doc.fileKey);

    await this.repository.delete(id, accountId);

    try {
      await fs.rm(filePath, { force: true });
    } catch {
      // Ignore physical removal error if file was already removed
    }

    await verificationRepository.recordAuditLog(
      accountId,
      accountId,
      doc.accountType,
      "document_deleted",
      { documentId: id, documentType: doc.documentType },
    );
  }
}

export const verificationDocumentService = new VerificationDocumentService(verificationDocumentRepository);
