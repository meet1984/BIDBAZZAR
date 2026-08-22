import { AppError } from "../../shared/AppError.js";
import { listingRepository } from "../listings/listing.repository.js";
import { publicListingDto } from "../listings/listing.service.js";
import type { WatchlistRepository } from "./watchlist.repository.js";
import { watchlistRepository } from "./watchlist.repository.js";

export class WatchlistService {
  constructor(private readonly repository: WatchlistRepository) {}

  async list(accountId: number) {
    const ids = await this.repository.listingIds(accountId);
    const records = await listingRepository.findPublicByIds(ids, accountId);
    return records.map(publicListingDto);
  }

  async add(accountId: number, listingId: number) {
    const listing = await listingRepository.findPublic(String(listingId), accountId);
    if (!listing) throw new AppError(404, "LISTING_NOT_FOUND", "The listing was not found.");
    await this.repository.add(accountId, listingId);
    return { watched: true };
  }

  async remove(accountId: number, listingId: number) {
    await this.repository.remove(accountId, listingId);
    return { watched: false };
  }
}

export const watchlistService = new WatchlistService(watchlistRepository);
