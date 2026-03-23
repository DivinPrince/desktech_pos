import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
} from "better-auth/plugins/admin/access";

const statement = {
  ...defaultStatements,
  product: ["create", "read", "update", "delete", "list"],
  category: ["create", "read", "update", "delete", "list"],
  brand: ["create", "read", "update", "delete", "list"],
  order: ["read", "update", "list", "cancel", "refund"],
} as const;

export const ac = createAccessControl(statement);

export const adminRole = ac.newRole({
  ...adminAc.statements,
  product: ["create", "read", "update", "delete", "list"],
  category: ["create", "read", "update", "delete", "list"],
  brand: ["create", "read", "update", "delete", "list"],
  order: ["read", "update", "list", "cancel", "refund"],
});

export const userRole = ac.newRole({
  product: ["read", "list"],
  category: ["read", "list"],
  brand: ["read", "list"],
  order: ["read", "list"],
});
