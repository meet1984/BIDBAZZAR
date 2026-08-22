export type VerificationStatus =
  | "profile_incomplete"
  | "draft"
  | "submitted"
  | "under_review"
  | "verified"
  | "changes_requested"
  | "rejected"
  | "suspended";

export type BuyerType = "individual" | "business";
export type SellerType = "individual" | "business" | "distributor";
export type VerificationAccountType = "buyer" | "seller";

export type GovernmentIdType =
  | "passport"
  | "drivers_license"
  | "national_id"
  | "voter_id"
  | "ssn_last4"
  | "tax_id"
  | "other";

export type VerificationDocumentType =
  | "government_id"
  | "address_proof"
  | "business_registration"
  | "tax_certificate"
  | "other";

export type VerificationDecisionAction =
  | "approve"
  | "reject"
  | "request_changes"
  | "suspend";

export interface BuyerProfileRecord {
  accountId: number;
  legalFullName: string;
  dateOfBirth: string | null;
  buyerType: BuyerType;
  verifiedEmail: string | null;
  verifiedPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  country: string | null;
  governmentIdType: GovernmentIdType | null;
  maskedGovernmentIdRef: string | null;
  businessName: string | null;
  gstNumber: string | null;
  profileImage: string | null;
  verificationStatus: VerificationStatus;
  verificationSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerProfileRecord {
  accountId: number;
  legalName: string;
  businessName: string;
  sellerType: SellerType;
  verifiedEmail: string | null;
  verifiedPhone: string | null;
  registeredAddressLine1: string | null;
  registeredAddressLine2: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  country: string | null;
  panGstRef: string | null;
  businessRegistrationInfo: string | null;
  productCategories: string[] | null;
  publicBusinessDescription: string | null;
  profileLogo: string | null;
  verificationStatus: VerificationStatus;
  verificationSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationDocumentRecord {
  id: number;
  accountId: number;
  accountType: VerificationAccountType;
  documentType: VerificationDocumentType;
  fileKey: string;
  originalName: string;
  fileMime: string;
  fileSize: number;
  createdAt: Date;
}

export interface VerificationDecisionRecord {
  id: number;
  accountId: number;
  accountType: VerificationAccountType;
  reviewerAccountId: number;
  action: VerificationDecisionAction;
  reason: string | null;
  createdAt: Date;
}

export interface VerificationAuditLogRecord {
  id: number;
  actorAccountId: number;
  targetAccountId: number;
  accountType: VerificationAccountType;
  action: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export type SaleMode = "negotiated_offer" | "multi_unit_offer";

export type ItemCondition = "new" | "like-new" | "used" | "refurbished";

export type ListingReviewStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "scheduled"
  | "open"
  | "offer_selection"
  | "sold"
  | "partially_sold"
  | "unsold"
  | "completed"
  | "changes_requested"
  | "rejected"
  | "cancelled"
  | "suspended"
  | "expired";

export interface CategoryRecord {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubcategoryRecord {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingRecord {
  id: number;
  sellerId: number;
  categoryId: number;
  subcategoryId: number | null;
  saleMode: SaleMode;
  title: string;
  description: string;
  condition: ItemCondition;
  location: string;
  askingPrice: number;
  currency: string;
  startTime: Date;
  endTime: Date;
  offerSelectionDeadline: Date | null;
  publicSlug: string;
  listingReference: string;
  reviewStatus: ListingReviewStatus;
  reviewNotes: string | null;
  version: number;

  // Multi-unit offer specific fields
  totalQuantity: number | null;
  unitName: string | null;
  askingPricePerUnit: number | null;
  minOrderQuantity: number | null;
  maxOrderQuantity: number | null;
  quantityIncrement: number | null;
  allowPartialAllocation: boolean;
  /** Private seller floor price - NEVER expose in public/buyer DTOs */
  minAcceptableUnitPrice?: number | null;
  offerStartTime?: Date | null;
  offerEndTime?: Date | null;
  buyerConfirmationDeadlineHours?: number;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ListingImageRecord {
  id: number;
  listingId: number;
  imageUrl: string;
  displayOrder: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type OfferStatus =
  | "submitted"
  | "revised"
  | "withdrawn"
  | "shortlisted"
  | "contact_requested"
  | "countered"
  | "accepted_pending_buyer"
  | "buyer_confirmed"
  | "buyer_declined"
  | "rejected"
  | "expired"
  | "cancelled";

export interface OfferRecord {
  id: number;
  listingId: number;
  buyerId: number;
  offeredAmount: number;
  counterAmount: number | null;
  currency: string;
  buyerMessage: string | null;
  sellerMessage: string | null;
  offerExpiry: Date | null;
  status: OfferStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type MultiUnitOfferStatus =
  | "submitted"
  | "revised"
  | "shortlisted"
  | "countered"
  | "allocation_proposed"
  | "allocation_reserved"
  | "confirmed"
  | "declined"
  | "expired"
  | "rejected"
  | "cancelled";

export interface MultiUnitOfferRecord {
  id: number;
  listingId: number;
  buyerId: number;
  quantityRequested: number;
  offeredPricePerUnit: number;
  totalOfferValue: number;
  buyerMessage: string | null;
  offerExpiry: Date | null;
  counterQuantity: number | null;
  counterUnitPrice: number | null;
  sellerMessage: string | null;
  status: MultiUnitOfferStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type MultiUnitAllocationStatus =
  | "proposed"
  | "reserved"
  | "confirmed"
  | "released"
  | "cancelled"
  | "expired";

export interface MultiUnitAllocationRecord {
  id: number;
  offerId: number;
  listingId: number;
  buyerId: number;
  allocatedQuantity: number;
  unitPrice: number;
  totalAllocationValue: number;
  status: MultiUnitAllocationStatus;
  reservedUntil: Date | null;
  confirmedAt: Date | null;
  releasedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderSourceType = "negotiated_offer" | "multi_unit_allocation";

export type OrderStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "disputed"
  | "resolved"
  | "failed";

export interface OrderRecord {
  id: number;
  orderReference: string;
  buyerId: number;
  sellerId: number;
  listingId: number;
  sourceType: OrderSourceType;
  sourceOfferId: number | null;
  sourceAllocationId: number | null;
  sourceReference: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  orderStatus: OrderStatus;
  buyerCompletedAt: Date | null;
  sellerCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DisputeReason =
  | "item_not_received"
  | "item_damaged"
  | "not_as_described"
  | "seller_unresponsive"
  | "buyer_unresponsive"
  | "other";

export type DisputeStatus =
  | "opened"
  | "under_review"
  | "resolved_buyer_favour"
  | "resolved_seller_favour"
  | "resolved_compromise"
  | "closed";

export interface DisputeRecord {
  id: number;
  orderId: number;
  disputeReference: string;
  openedByAccountId: number;
  reason: DisputeReason;
  details: string;
  status: DisputeStatus;
  resolutionNotes: string | null;
  resolvedByAccountId: number | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDirection = "buyer_to_seller" | "seller_to_buyer";

export interface BuyerToSellerCategoryRatings {
  productAccuracy: number;
  communication: number;
  transactionCooperation: number;
  overallExperience: number;
}

export interface SellerToBuyerCategoryRatings {
  agreementReliability: number;
  communication: number;
  transactionCooperation: number;
}

export interface ReviewRecord {
  id: number;
  orderId: number;
  reviewerId: number;
  revieweeId: number;
  direction: ReviewDirection;
  ratingScore: number;
  categoryRatings: BuyerToSellerCategoryRatings | SellerToBuyerCategoryRatings | Record<string, number>;
  comment: string;
  isPublished: boolean;
  hiddenReason: string | null;
  hiddenByAccountId: number | null;
  hiddenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewReportReason =
  | "offensive_language"
  | "spam"
  | "false_information"
  | "harassment"
  | "privacy_violation"
  | "other";

export type ReviewReportStatus = "pending" | "reviewed" | "dismissed" | "action_taken";

export interface ReviewReportRecord {
  id: number;
  reviewId: number;
  reporterId: number;
  reason: ReviewReportReason;
  details: string | null;
  status: ReviewReportStatus;
  reviewedByAccountId: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminPermission =
  | "verification_review"
  | "listing_review"
  | "support_management"
  | "order_oversight"
  | "dispute_management"
  | "review_moderation"
  | "category_management";

export interface AdminPermissionRecord {
  id: number;
  accountId: number;
  permission: AdminPermission;
  grantedByAccountId: number;
  createdAt: Date;
}

export interface AuditLogRecord {
  id: number;
  actorAccountId: number | null;
  action: string;
  targetEntity: string;
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface NotificationRecord {
  id: number;
  recipientAccountId: number;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}
