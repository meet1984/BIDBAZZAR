import fs from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { env } from "../config/env.js";
import { pool, withTransaction } from "../database/pool.js";
import { localStorageService } from "../shared/storage/localStorage.service.js";

export interface MigrationReport {
  dryRun: boolean;
  totalProcessed: number;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

function parseBase64DataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) return null;
  return { buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64"), mimeType: match[1] };
}

function imageList(rawValue: string): string[] {
  if (rawValue.startsWith("data:image")) return [rawValue];
  if (!rawValue.trim().startsWith("[")) return [];
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.startsWith("data:image"))
      : [];
  } catch {
    return [];
  }
}

export async function runBase64ImageMigration(options: { batchSize?: number; apply?: boolean } = {}): Promise<MigrationReport> {
  const batchSize = Math.min(Math.max(options.batchSize ?? 25, 1), 100);
  const dryRun = options.apply !== true;
  const report: MigrationReport = { dryRun, totalProcessed: 0, migratedCount: 0, skippedCount: 0, errors: [] };
  let lastId = 0;

  while (true) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, image_url FROM auctions
       WHERE id > ? AND image_url IS NOT NULL
         AND (image_url LIKE 'data:image%' OR image_url LIKE '[%data:image%')
       ORDER BY id ASC LIMIT ?`,
      [lastId, batchSize],
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      const auctionId = Number(row.id);
      lastId = auctionId;
      report.totalProcessed++;
      const parsedImages = imageList(String(row.image_url || "")).map(parseBase64DataUrl);
      if (parsedImages.length === 0 || parsedImages.some((image) => image === null)) {
        report.skippedCount++;
        continue;
      }
      if (dryRun) continue;

      const storedImages: Array<{ fileKey: string; url: string }> = [];
      try {
        for (let index = 0; index < parsedImages.length; index++) {
          const image = parsedImages[index]!;
          const stored = await localStorageService.saveImage(image.buffer, `legacy_auction_${auctionId}_${index + 1}`, image.mimeType, "listings");
          const diskPath = path.resolve(process.cwd(), env.UPLOAD_DIR, stored.fileKey);
          const stat = await fs.stat(diskPath);
          if (!stat.isFile() || stat.size === 0) throw new Error("Stored image verification failed.");
          storedImages.push({ fileKey: stored.fileKey, url: stored.url });
        }

        await withTransaction(async (connection) => {
          const [listingRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM listings WHERE id = ? FOR UPDATE", [auctionId]);
          if (listingRows[0]) {
            for (let index = 0; index < storedImages.length; index++) {
              const stored = storedImages[index]!;
              await connection.execute(
                `INSERT INTO listing_images (listing_id, image_url, display_order, is_primary)
                 SELECT ?, ?, ?, ? FROM DUAL
                 WHERE NOT EXISTS (SELECT 1 FROM listing_images WHERE listing_id = ? AND image_url = ?)`,
                [auctionId, stored.url, index + 1, index === 0, auctionId, stored.url],
              );
            }
          }
          const finalValue = storedImages.length === 1 ? storedImages[0]!.url : JSON.stringify(storedImages.map((image) => image.url));
          await connection.execute("UPDATE auctions SET image_url = ? WHERE id = ?", [finalValue, auctionId]);
        });
        report.migratedCount++;
      } catch (error) {
        await Promise.all(storedImages.map((image) => localStorageService.deleteImage(image.fileKey).catch(() => undefined)));
        report.errors.push(`Auction #${auctionId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return report;
}

if (process.argv[1]?.endsWith("migrate-base64-images.ts")) {
  const apply = process.argv.includes("--apply");
  runBase64ImageMigration({ apply })
    .then(async (report) => {
      console.log(report);
      if (!apply) console.log("Dry run only. Re-run with --apply after backup and review.");
      await pool.end();
    })
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      await pool.end().catch(() => undefined);
      process.exitCode = 1;
    });
}
