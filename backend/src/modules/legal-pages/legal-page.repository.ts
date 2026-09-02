import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type { LegalPageRecord, LegalPageSlug, UpdateLegalPageInput } from "./legal-page.types.js";

const DEFAULT_PAGES: Record<LegalPageSlug, { title: string; contentHtml: string }> = {
  terms: {
    title: "Marketplace Terms & Conditions",
    contentHtml: `<h2>1. Marketplace Overview & Account Accuracy</h2>
<p>BidMyLot is a dedicated auction and offer marketplace connecting buyers and sellers for negotiated single-unit and multi-unit lots. All users must provide accurate, verifiable account details and listing information at all times.</p>
<h2>2. Offers, Negotiations & Agreements</h2>
<p>Offers and bids placed on BidMyLot are private between the buyer, seller, and authorized marketplace administrators. A confirmed offer or allocation creates a direct, binding transaction agreement between the buyer and seller.</p>
<h2>3. Settlement & Logistics</h2>
<p>BidMyLot facilitates listing discovery, offer negotiation, and deal confirmation. BidMyLot does not process direct payments, delivery, or logistics collection. Parties are directly responsible for executing settlement and delivery as agreed.</p>
<h2>4. Prohibited Activities</h2>
<p>Fraud, price manipulation, shill bidding, self-offering, harassment, and unauthorized system access are strictly prohibited. Violations will result in immediate account suspension and potential legal action.</p>
<h2>5. Reviews & Dispute Resolution</h2>
<p>All dispute actions and transaction reviews must reflect genuine transactions. The marketplace administration reserves the right to moderate reviews and oversee dispute resolution according to platform policies.</p>`,
  },
  privacy: {
    title: "Privacy Policy & Data Notice",
    contentHtml: `<h2>1. Information We Collect</h2>
<p>BidMyLot collects and processes account details, verification documents, listings, offers, orders, and inquiry information necessary to operate a secure marketplace.</p>
<h2>2. Document Privacy & Confidentiality</h2>
<p>Government identity and business verification documents are strictly private and accessible only through authorized, authenticated administrative endpoints for verification purposes.</p>
<h2>3. Public vs Private Profile Information</h2>
<p>Public marketplace profiles exclude private offer terms, confidential identity records, and direct contact details. Contact information is shared only between confirmed transaction counterparties and authorized administrators.</p>
<h2>4. Data Retention & Security</h2>
<p>Operational, transactional, and audit records are retained securely as required for security auditing, fraud prevention, dispute resolution, and legal compliance.</p>
<h2>5. Your Rights & Data Requests</h2>
<p>Users may review and update their profile details or contact BidMyLot support to request data corrections or account inquiries.</p>`,
  },
};

function legalPageFromRow(row: RowDataPacket): LegalPageRecord {
  return {
    id: Number(row.id),
    slug: row.slug as LegalPageSlug,
    title: String(row.title),
    contentHtml: String(row.content_html),
    updatedBy: row.updated_by == null ? null : Number(row.updated_by),
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class LegalPageRepository {
  async findBySlug(slug: LegalPageSlug): Promise<LegalPageRecord | null> {
    try {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT * FROM legal_pages WHERE slug = ? LIMIT 1",
        [slug],
      );
      if (rows[0]) {
        return legalPageFromRow(rows[0]);
      }
      return null;
    } catch {
      // Return fallback in unmigrated environment
      const defaultData = DEFAULT_PAGES[slug];
      if (!defaultData) return null;
      return {
        id: 0,
        slug,
        title: defaultData.title,
        contentHtml: defaultData.contentHtml,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  async upsertPage(slug: LegalPageSlug, input: UpdateLegalPageInput): Promise<LegalPageRecord> {
    await pool.execute(
      `INSERT INTO legal_pages (slug, title, content_html, updated_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         content_html = VALUES(content_html),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [slug, input.title, input.contentHtml, input.updatedBy ?? null],
    );

    const updated = await this.findBySlug(slug);
    if (!updated) {
      throw new Error(`Failed to retrieve legal page after upsert: ${slug}`);
    }
    return updated;
  }

  async ensureDefaults(): Promise<void> {
    try {
      for (const slug of ["terms", "privacy"] as const) {
        const defaultData = DEFAULT_PAGES[slug];
        await pool.execute(
          `INSERT INTO legal_pages (slug, title, content_html)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE title = title`,
          [slug, defaultData.title, defaultData.contentHtml],
        );
      }
    } catch {
      // Ignored if table doesn't exist yet
    }
  }
}

export const legalPageRepository = new LegalPageRepository();
