import { AppError } from "../../shared/AppError.js";
import type { VerificationStatus } from "../../types/database.types.js";

export const EDITABLE_STATUSES: readonly VerificationStatus[] = [
  "profile_incomplete",
  "draft",
  "changes_requested",
];

export const LOCKED_STATUSES: readonly VerificationStatus[] = [
  "submitted",
  "under_review",
  "verified",
  "rejected",
  "suspended",
];

export function isProfileEditable(status: VerificationStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function isMarketplaceAllowed(status: VerificationStatus): boolean {
  return status === "verified";
}

export function validateStateTransition(
  currentStatus: VerificationStatus,
  targetStatus: VerificationStatus,
  reason?: string | null,
): void {
  if (currentStatus === targetStatus) return;

  if (targetStatus === "suspended") {
    // Admin can suspend from any state
    return;
  }

  if (currentStatus === "suspended") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "Suspended profiles cannot transition to another state without admin reactivation.");
  }

  switch (currentStatus) {
    case "profile_incomplete":
    case "draft":
    case "changes_requested":
      if (
        targetStatus !== "draft" &&
        targetStatus !== "submitted" &&
        targetStatus !== "changes_requested"
      ) {
        throw new AppError(400, "INVALID_TRANSITION", `Cannot transition from ${currentStatus} to ${targetStatus}.`);
      }
      break;

    case "submitted":
    case "under_review":
      if (
        targetStatus !== "under_review" &&
        targetStatus !== "changes_requested" &&
        targetStatus !== "rejected" &&
        targetStatus !== "verified"
      ) {
        throw new AppError(400, "INVALID_TRANSITION", `Submitted profiles must move to review, approval, or rejection.`);
      }
      break;

    case "verified":
      if (targetStatus !== "changes_requested" && targetStatus !== "rejected" && targetStatus !== "draft") {
        throw new AppError(400, "INVALID_TRANSITION", `Verified profiles can only be requested to update or suspended.`);
      }
      break;

    case "rejected":
      if (targetStatus !== "draft" && targetStatus !== "submitted") {
        throw new AppError(400, "INVALID_TRANSITION", `Rejected profiles must be corrected and submitted again.`);
      }
      break;

    default:
      throw new AppError(400, "INVALID_TRANSITION", `Unknown verification status: ${String(currentStatus)}.`);
  }

  if ((targetStatus === "rejected" || targetStatus === "changes_requested") && (!reason || !reason.trim())) {
    throw new AppError(400, "REASON_REQUIRED", `Transition to ${targetStatus} requires a non-empty explanation reason.`);
  }
}
