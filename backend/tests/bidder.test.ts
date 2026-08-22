import { describe, expect, it } from "vitest";
import { formatBidderName } from "../src/shared/bidder.js";

describe("formatBidderName", () => {
  it("produces deterministic labels for the same bidder", () => {
    const label1 = formatBidderName(12345);
    const label2 = formatBidderName(12345);
    expect(label1).toEqual(label2);
  });

  it("produces different labels for different bidders", () => {
    const label1 = formatBidderName(7);
    const label2 = formatBidderName(1007);
    expect(label1).not.toEqual(label2);
  });
});
