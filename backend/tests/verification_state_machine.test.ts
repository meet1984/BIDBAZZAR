import { describe, expect, it } from "vitest";
import { validateStateTransition } from "../src/modules/verification/verification.state-machine.js";

describe("Verification State Machine", () => {
  describe("Suspended state transitions", () => {
    it("allows admin to reactivate/approve a suspended account (transition from suspended to verified)", () => {
      expect(() => validateStateTransition("suspended", "verified")).not.toThrow();
    });

    it("allows admin to request changes on a suspended account with a reason", () => {
      expect(() => validateStateTransition("suspended", "changes_requested", "Please re-upload valid government ID.")).not.toThrow();
    });

    it("requires a reason when requesting changes on a suspended account", () => {
      expect(() => validateStateTransition("suspended", "changes_requested", "")).toThrowError(/requires a non-empty explanation reason/);
    });

    it("allows admin to reject a suspended account with a reason", () => {
      expect(() => validateStateTransition("suspended", "rejected", "Fraudulent documents detected.")).not.toThrow();
    });

    it("blocks user from transitioning from suspended to submitted directly", () => {
      expect(() => validateStateTransition("suspended", "submitted")).toThrowError(/Suspended profiles can only transition to verified, changes_requested, or rejected/);
    });

    it("blocks user from transitioning from suspended to draft", () => {
      expect(() => validateStateTransition("suspended", "draft")).toThrowError(/Suspended profiles can only transition to verified, changes_requested, or rejected/);
    });
  });

  describe("Suspending accounts", () => {
    it("allows suspending from any state", () => {
      expect(() => validateStateTransition("profile_incomplete", "suspended")).not.toThrow();
      expect(() => validateStateTransition("draft", "suspended")).not.toThrow();
      expect(() => validateStateTransition("submitted", "suspended")).not.toThrow();
      expect(() => validateStateTransition("under_review", "suspended")).not.toThrow();
      expect(() => validateStateTransition("verified", "suspended")).not.toThrow();
      expect(() => validateStateTransition("changes_requested", "suspended")).not.toThrow();
      expect(() => validateStateTransition("rejected", "suspended")).not.toThrow();
    });
  });

  describe("Standard transitions", () => {
    it("allows submitted profiles to move to verified", () => {
      expect(() => validateStateTransition("submitted", "verified")).not.toThrow();
    });

    it("allows under_review profiles to move to verified", () => {
      expect(() => validateStateTransition("under_review", "verified")).not.toThrow();
    });

    it("same state transition is a no-op", () => {
      expect(() => validateStateTransition("verified", "verified")).not.toThrow();
      expect(() => validateStateTransition("suspended", "suspended")).not.toThrow();
    });
  });
});
