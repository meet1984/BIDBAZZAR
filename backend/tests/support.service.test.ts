import { describe, expect, it, vi, beforeEach } from "vitest";
import { SupportService } from "../src/modules/support/support.service.js";
import type { SupportRepository } from "../src/modules/support/support.repository.js";

vi.mock("../src/shared/mailer.js", () => ({
  sendEmail: vi.fn(() => Promise.resolve(true)),
}));

describe("SupportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("retries ticket creation on reference collision", async () => {
    let callCount = 0;
    const repository = {
      create: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error("Duplicate entry");
          (error as Error & { code?: string }).code = "ER_DUP_ENTRY";
          throw error;
        }
        return Promise.resolve();
      }),
      list: vi.fn(),
      getById: vi.fn(),
    } as unknown as SupportRepository;

    const service = new SupportService(repository);
    
    const result = await service.create(
      { 
        fullName: "Test User", 
        email: "test@example.com", 
        role: "visitor",
        reason: "auction-bidding",
        subject: "Help",
        message: "Help", 
        consent: true
      },
      undefined,
    );
    
    expect(callCount).toBe(2);
    expect(result.reference).toMatch(/^SUP-\d{8}-\d{6}$/);
    expect(repository.create).toHaveBeenCalledTimes(2);
  });

  it("lists tickets for a specific user", async () => {
    const mockTickets = [
      { id: 1, reference: "SUP-001", subject: "Dispute", status: "open" },
    ];
    const repository = {
      listByUser: vi.fn().mockResolvedValue(mockTickets),
    } as unknown as SupportRepository;

    const service = new SupportService(repository);
    const result = await service.listByUser(10, "user@example.com", "buyer");

    expect(repository.listByUser).toHaveBeenCalledWith(10, "user@example.com", "buyer");
    expect(result).toEqual(mockTickets);
  });

  it("updates ticket status when enquiry exists", async () => {
    const repository = {
      getById: vi.fn().mockResolvedValue({ id: 5, reference: "SUP-005" }),
      updateStatus: vi.fn().mockResolvedValue(true),
    } as unknown as SupportRepository;

    const service = new SupportService(repository);
    const result = await service.updateStatus(5, "resolved");

    expect(repository.getById).toHaveBeenCalledWith(5);
    expect(repository.updateStatus).toHaveBeenCalledWith(5, "resolved");
    expect(result).toEqual({ id: 5, status: "resolved" });
  });

  it("dispatches submitter and admin emails on creation", async () => {
    const { sendEmail } = await import("../src/shared/mailer.js");
    const mailerMock = vi.mocked(sendEmail);
    mailerMock.mockResolvedValue(true);

    const repository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as SupportRepository;

    const service = new SupportService(repository);
    const result = await service.create(
      {
        fullName: "Jane Doe",
        email: "jane@example.com",
        role: "buyer",
        reason: "auction-bidding",
        subject: "Cannot place bid",
        message: "I encountered an error when attempting to place a bid on lot #123.",
        consent: true,
      },
      12,
    );

    expect(result.reference).toBeDefined();
    // Allow fire-and-forget Promise to resolve
    await new Promise((r) => setTimeout(r, 50));
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("succeeds creating enquiry even if mailer fails", async () => {
    const { sendEmail } = await import("../src/shared/mailer.js");
    const mailerMock = vi.mocked(sendEmail);
    mailerMock.mockRejectedValue(new Error("SMTP server down"));

    const repository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as SupportRepository;

    const service = new SupportService(repository);
    const result = await service.create(
      {
        fullName: "John Smith",
        email: "john@example.com",
        role: "visitor",
        reason: "general",
        subject: "Shipping policy",
        message: "How long does shipping take after winning an auction?",
        consent: true,
      },
      undefined,
    );

    expect(result.reference).toBeDefined();
    // Allow fire-and-forget Promise to resolve
    await new Promise((r) => setTimeout(r, 50));
  });
});
