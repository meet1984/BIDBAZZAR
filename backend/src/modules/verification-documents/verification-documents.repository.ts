import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { VerificationAccountType, VerificationDocumentRecord, VerificationDocumentType } from "../../types/database.types.js";

export interface StoredDocumentInput {
  documentType: VerificationDocumentType;
  originalName: string;
  fileMime: "image/jpeg" | "image/png" | "application/pdf";
  fileSize: number;
}

function mapDocumentRow(row: RowDataPacket): VerificationDocumentRecord {
  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    accountType: row.account_type as VerificationAccountType,
    documentType: row.document_type as VerificationDocumentType,
    fileKey: String(row.file_key),
    originalName: String(row.original_name),
    fileMime: String(row.file_mime),
    fileSize: Number(row.file_size),
    createdAt: new Date(row.created_at as string | Date),
  };
}

export class VerificationDocumentRepository {
  async findById(id: number): Promise<VerificationDocumentRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, account_id, account_type, document_type, file_key, original_name, file_mime, file_size, created_at
       FROM verification_documents WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? mapDocumentRow(rows[0]) : null;
  }

  async findByAccount(accountId: number, accountType?: VerificationAccountType): Promise<VerificationDocumentRecord[]> {
    if (accountType) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, account_id, account_type, document_type, file_key, original_name, file_mime, file_size, created_at
         FROM verification_documents
         WHERE account_id = ? AND account_type = ?
         ORDER BY created_at DESC`,
        [accountId, accountType],
      );
      if (rows.length > 0) return rows.map(mapDocumentRow);
    }
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, account_id, account_type, document_type, file_key, original_name, file_mime, file_size, created_at
       FROM verification_documents
       WHERE account_id = ?
       ORDER BY created_at DESC`,
      [accountId],
    );
    return rows.map(mapDocumentRow);
  }

  async create(
    accountId: number,
    accountType: VerificationAccountType,
    fileKey: string,
    input: StoredDocumentInput,
  ): Promise<VerificationDocumentRecord> {
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO verification_documents
        (account_id, account_type, document_type, file_key, original_name, file_mime, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        accountId,
        accountType,
        input.documentType,
        fileKey,
        input.originalName,
        input.fileMime,
        input.fileSize,
      ],
    );

    const created = await this.findById(Number(result.insertId));
    if (!created) throw new Error("Failed to create document metadata record.");
    return created;
  }

  async delete(id: number, accountId: number): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM verification_documents WHERE id = ? AND account_id = ?`,
      [id, accountId],
    );
    return result.affectedRows > 0;
  }
}

export const verificationDocumentRepository = new VerificationDocumentRepository();
