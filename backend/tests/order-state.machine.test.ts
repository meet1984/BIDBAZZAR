import { describe, expect, it } from "vitest";
import { validateOrderTransition } from "../src/modules/orders/order-state.machine.js";

describe("direct deal order state machine", () => {
  it("allows confirmed deals to complete, cancel, or enter dispute", () => {
    expect(() => validateOrderTransition("confirmed", "completed")).not.toThrow();
    expect(() => validateOrderTransition("confirmed", "cancelled")).not.toThrow();
    expect(() => validateOrderTransition("confirmed", "disputed")).not.toThrow();
  });

  it("does not reopen terminal deals", () => {
    expect(() => validateOrderTransition("cancelled", "confirmed")).toThrow();
    expect(() => validateOrderTransition("resolved", "confirmed")).toThrow();
  });
});
