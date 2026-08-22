import { listingService } from "../listings/listing.service.js";
import { supportService } from "../support/support.service.js";
import { userService } from "../users/user.service.js";

export class DashboardService {
  async admin() {
    const [pendingListingsRes, users, enquiries] = await Promise.all([
      listingService.listAdmin("submitted"),
      userService.list({ q: "", page: 1, pageSize: 20 }),
      supportService.list(),
    ]);

    const rawListings = (pendingListingsRes || []) as unknown as Array<Record<string, unknown>>;
    const mappedListings = rawListings.map((l) => ({
      id: Number(l.id),
      title: typeof l.title === "string" ? l.title : "",
      category: typeof l.categoryName === "string" ? l.categoryName : "General",
      startingPrice: Number(l.askingPrice || l.askingPricePerUnit || 0),
      lotNumber: typeof l.listingReference === "string" ? l.listingReference : `LOT-${Number(l.id)}`,
      seller: { name: typeof l.sellerName === "string" ? l.sellerName : "Seller" },
      status: String(l.reviewStatus),
      rawListing: l,
    }));

    return {
      pendingAuctions: mappedListings,
      users: users.items,
      enquiries: enquiries.slice(0, 20),
    };
  }
}

export const dashboardService = new DashboardService();
