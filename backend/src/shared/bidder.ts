import { createHash } from "node:crypto";

export function formatBidderName(bidderId: number): string {
  const hash = createHash("sha256")
    .update(String(bidderId))
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();
  return `Bidder #${hash}`;
}
