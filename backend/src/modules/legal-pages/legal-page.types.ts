export type LegalPageSlug = "terms" | "privacy";

export interface LegalPageRecord {
  id: number;
  slug: LegalPageSlug;
  title: string;
  contentHtml: string;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateLegalPageInput {
  title: string;
  contentHtml: string;
  updatedBy?: number | null;
}
