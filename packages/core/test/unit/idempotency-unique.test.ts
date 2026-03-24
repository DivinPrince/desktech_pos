import { describe, expect, it } from "vitest";

function isUniqueViolation(e: unknown): boolean {
  const topCode = (e as { code?: string }).code;
  const causeCode = (e as { cause?: { code?: string } })?.cause?.code;
  const msg = e instanceof Error ? e.message : String(e);
  return (
    topCode === "23505" ||
    causeCode === "23505" ||
    msg.includes("duplicate key") ||
    msg.includes("23505")
  );
}

describe("idempotency unique detection", () => {
  it("detects postgres code on error", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects nested cause code", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("detects duplicate key message", () => {
    expect(
      isUniqueViolation(new Error('duplicate key value violates unique constraint "api_idempotency_key_pkey"')),
    ).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isUniqueViolation(new Error("connection refused"))).toBe(false);
  });
});
