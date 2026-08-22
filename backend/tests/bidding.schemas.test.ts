import { describe, expect, it } from "vitest";
import { placeBidSchema } from "../src/modules/bidding/bidding.schemas.js";

describe("placeBidSchema", () => {
  it("accepts valid bid amounts with up to two decimal places, regardless of IEEE 754 precision issues", () => {
    // 19.99 * 100 === 1998.9999999999998
    expect(() => placeBidSchema.parse({ amount: 19.99 })).not.toThrow();
    // 0.29 * 100 === 28.999999999999996
    expect(() => placeBidSchema.parse({ amount: 0.29 })).not.toThrow();
    // other regular values
    expect(() => placeBidSchema.parse({ amount: 100.20 })).not.toThrow();
    expect(() => placeBidSchema.parse({ amount: 33.33 })).not.toThrow();
    expect(() => placeBidSchema.parse({ amount: 50 })).not.toThrow();
  });

  it("rejects bid amounts with three or more decimal places", () => {
    expect(() => placeBidSchema.parse({ amount: 19.999 })).toThrow(/Bid amount supports at most two decimals/);
    expect(() => placeBidSchema.parse({ amount: 0.291 })).toThrow(/Bid amount supports at most two decimals/);
    expect(() => placeBidSchema.parse({ amount: 100.205 })).toThrow(/Bid amount supports at most two decimals/);
  });
});
