import { describe, expect, it } from "vitest";
import { businessRoleAtLeast } from "./authz";

describe("businessRoleAtLeast", () => {
  it("treats owner as highest", () => {
    expect(businessRoleAtLeast("owner", "owner")).toBe(true);
    expect(businessRoleAtLeast("owner", "manager")).toBe(true);
    expect(businessRoleAtLeast("owner", "cashier")).toBe(true);
  });

  it("allows manager for manager and cashier minimums only", () => {
    expect(businessRoleAtLeast("manager", "manager")).toBe(true);
    expect(businessRoleAtLeast("manager", "cashier")).toBe(true);
    expect(businessRoleAtLeast("manager", "owner")).toBe(false);
  });

  it("allows cashier only for cashier minimum", () => {
    expect(businessRoleAtLeast("cashier", "cashier")).toBe(true);
    expect(businessRoleAtLeast("cashier", "manager")).toBe(false);
    expect(businessRoleAtLeast("cashier", "owner")).toBe(false);
  });
});
