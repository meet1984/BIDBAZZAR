import { AppError } from "../../shared/AppError.js";
import type { OrderStatus } from "../../types/database.types.js";

/** A confirmed deal exposes contact details. Completion requires both parties. */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  confirmed: ["completed", "cancelled", "disputed", "failed"],
  completed: ["disputed"],
  cancelled: [],
  disputed: ["resolved", "completed", "cancelled", "failed"],
  resolved: [],
  failed: [],
};

export function validateOrderTransition(current: OrderStatus, target: OrderStatus): void {
  if (current === target) return;
  if (!ALLOWED_ORDER_TRANSITIONS[current]?.includes(target)) {
    throw new AppError(409, "INVALID_ORDER_TRANSITION", `Cannot transition order from '${current}' to '${target}'.`);
  }
}
