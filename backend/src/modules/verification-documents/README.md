# Verification Documents Module

## Purpose
Manages identity and business verification documents (government ID, address proof, business registration, tax certificates) safely without exposing raw filesystem paths, with server-side binary magic byte signature verification, secure storage outside the web root, authenticated streaming file download, and admin access audit logging.

## Files & Responsibilities
- `verification-documents.schemas.ts`: Zod schemas for document metadata input and parameters.
- `verification-documents.repository.ts`: Database operations targeting `verification_documents`.
- `verification-documents.service.ts`: Document signature checking (`hasExpectedSignature`), storage in `env.UPLOAD_DIR`, streaming download, audit logging (`document_viewed`), and DTO redaction.
- `verification-documents.controller.ts`: Express request handlers for listing, uploading, streaming file download, and removing documents.
- `verification-documents.routes.ts`: Router endpoints with Multer upload middleware and auth protection.

## Database Tables
- `verification_documents`
- `verification_audit_log` (logs admin document view events)

## API Endpoints
- `GET /api/verification/documents`: List own document metadata.
- `POST /api/verification/documents`: Upload file with `document` field & type metadata (JPEG/PNG/PDF, max 5 MB).
- `GET /api/verification/documents/:id/download`: Authenticated streaming file download (Restricted to document owner and authorized admins).
- `DELETE /api/verification/documents/:id`: Remove verification document.

## Permissions & Security Rules
- Files are stored outside the public web root in `env.UPLOAD_DIR/verification/` with non-guessable UUID filenames (`verif_${randomUUID()}.${ext}`).
- Declared MIME types are validated against binary magic byte headers (`0xFF 0xD8 0xFF` for JPEG, `0x89 0x50 0x4E 0x47` for PNG, `%PDF-` for PDF).
- Raw filesystem paths are NEVER stored in queryable database columns or returned in API responses.
- Document streaming is strictly restricted to document owner and authorized admins.
- When an admin views/downloads a document, an audit log entry (`action = 'document_viewed'`) is recorded in `verification_audit_log`.

## Document Retention & Deletion Policy
- Uploaded files are retained while account verification is under review or verified.
- When a document is removed by the user or following account rejection cleanup, physical files are permanently removed from storage using `fs.rm`.

## Testing Instructions
- Run unit/integration tests with `npm test tests/phase3_workflow_security.test.ts`.
