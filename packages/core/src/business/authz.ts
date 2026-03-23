import type { BusinessMemberRole } from "./business.sql";

const order: Record<BusinessMemberRole, number> = {
  cashier: 1,
  manager: 2,
  owner: 3,
};

export function businessRoleAtLeast(
  role: BusinessMemberRole,
  minimum: BusinessMemberRole,
): boolean {
  return order[role] >= order[minimum];
}
