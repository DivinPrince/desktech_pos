import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/admin/access";

/**
 * Platform-level (Better Auth admin plugin) access statements.
 * Day-to-day POS authorization is enforced per-business via `business_member.role`
 * in API middleware (`requireBusinessMinimum`, etc.).
 */
const statement = {
  ...defaultStatements,
  /** Catalog */
  product: ["create", "read", "update", "delete", "list"],
  category: ["create", "read", "update", "delete", "list"],
  brand: ["create", "read", "update", "delete", "list"],
  /** Legacy / generic order wording — prefer `sale` for POS */
  order: ["read", "update", "list", "cancel", "refund"],
  /** POS sales lifecycle */
  sale: ["create", "read", "update", "list", "complete", "void", "refund"],
  /** Multi-business tenancy */
  business: ["create", "read", "update", "delete", "list", "invite", "manage_members"],
  /** Stock and batches */
  inventory: ["read", "adjust", "receive", "transfer", "audit"],
  stock_batch: ["create", "read", "update", "delete", "list"],
  /** Dining / floor */
  dining_table: ["create", "read", "update", "delete", "list", "layout"],
  /** Money out */
  expense: ["create", "read", "update", "delete", "list"],
  /** Analytics */
  report: ["read", "export"],
  /** Registers / devices (future) */
  pos_register: ["create", "read", "update", "delete", "list", "open", "close"],
  /** Suppliers / purchasing (future) */
  supplier: ["create", "read", "update", "delete", "list"],
} as const;

export const ac = createAccessControl(statement);

const fullProductCatalog = {
  product: ["create", "read", "update", "delete", "list"],
  category: ["create", "read", "update", "delete", "list"],
  brand: ["create", "read", "update", "delete", "list"],
} as const;

const fullPosOps = {
  order: ["read", "update", "list", "cancel", "refund"],
  sale: ["create", "read", "update", "list", "complete", "void", "refund"],
  inventory: ["read", "adjust", "receive", "transfer", "audit"],
  stock_batch: ["create", "read", "update", "delete", "list"],
  dining_table: ["create", "read", "update", "delete", "list", "layout"],
  expense: ["create", "read", "update", "delete", "list"],
  report: ["read", "export"],
  pos_register: ["create", "read", "update", "delete", "list", "open", "close"],
  supplier: ["create", "read", "update", "delete", "list"],
} as const;

export const adminRole = ac.newRole({
  ...adminAc.statements,
  ...fullProductCatalog,
  ...fullPosOps,
  business: ["create", "read", "update", "delete", "list", "invite", "manage_members"],
});

/** Default signed-in user: read-only catalog; no platform admin. */
export const userRole = ac.newRole({
  product: ["read", "list"],
  category: ["read", "list"],
  brand: ["read", "list"],
  order: ["read", "list"],
  sale: ["read", "list"],
  business: ["read", "list"],
  inventory: ["read"],
  stock_batch: ["read", "list"],
  dining_table: ["read", "list"],
  expense: ["read", "list"],
  report: ["read"],
  pos_register: ["read", "list"],
  supplier: ["read", "list"],
});
