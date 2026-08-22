import type { OrderRecord, OrderStatus, OrderSourceType, ReviewRecord } from "../../types/database.types.js";

export interface CreateOrderParams {
  buyerId: number;
  sellerId: number;
  listingId: number;
  sourceType: OrderSourceType;
  sourceOfferId?: number | null;
  sourceAllocationId?: number | null;
  sourceReference: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
}

export interface ListOrdersFilter {
  buyerId?: number;
  sellerId?: number;
  listingId?: number;
  orderStatus?: OrderStatus;
  sourceType?: OrderSourceType;
  limit?: number;
  offset?: number;
}

export interface BuyerCounterpartyDetails {
  name: string;
  phone: string | null;
  email: string | null;
  buyerType: string;
  businessName: string | null;
}

export interface SellerCounterpartyDetails {
  legalName: string;
  businessName: string;
  sellerType: string;
  phone: string | null;
  email: string | null;
}

export interface OrderListingDetails {
  id: number;
  title: string;
  saleMode: string;
  condition: string;
  location: string;
  publicSlug: string | null;
  listingReference: string | null;
  primaryImageUrl: string | null;
}

export interface OrderDetails extends OrderRecord {
  buyerDetails?: BuyerCounterpartyDetails | null;
  sellerDetails?: SellerCounterpartyDetails | null;
  listingDetails?: OrderListingDetails | null;
  buyerReview?: ReviewRecord | null;
  sellerReview?: ReviewRecord | null;
}

export type { OrderRecord, OrderStatus, OrderSourceType };
