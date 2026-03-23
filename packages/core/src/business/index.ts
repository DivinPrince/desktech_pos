import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { withTransaction, createTransaction } from "../drizzle/transaction";
import { ErrorCodes, NotFoundError, VisibleError } from "../error";
import { createID } from "../util/id";
import { fn } from "../util/fn";
import { businessMemberTable, businessTable, type BusinessMemberRole } from "./business.sql";
import { userTable } from "../user/user.sql";

export * from "./business.sql";
export * from "./authz";

export namespace BusinessService {
  export const Info = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    timezone: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  export const MemberInfo = z.object({
    id: z.string(),
    businessId: z.string(),
    userId: z.string(),
    userEmail: z.string().nullable(),
    userName: z.string().nullable(),
    role: z.enum(["owner", "manager", "cashier"]),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

  function serializeBusiness(row: typeof businessTable.$inferSelect): z.infer<typeof Info> {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  export const CreateInput = z.object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(120).optional(),
    timezone: z.string().max(64).optional(),
    ownerUserId: z.string(),
  });

  export const UpdateInput = z.object({
    id: z.string(),
    name: z.string().min(1).max(255).optional(),
    slug: z.string().min(1).max(120).nullable().optional(),
    timezone: z.string().max(64).optional(),
  });

  export const AddMemberInput = z.object({
    businessId: z.string(),
    userEmail: z.string().email(),
    role: z.enum(["owner", "manager", "cashier"]),
  });

  export const UpdateMemberRoleInput = z.object({
    businessId: z.string(),
    memberUserId: z.string(),
    role: z.enum(["owner", "manager", "cashier"]),
  });

  export async function membership(
    businessId: string,
    userId: string,
  ): Promise<{ role: BusinessMemberRole } | null> {
    return withTransaction(async (tx) => {
      const [row] = await tx
        .select({ role: businessMemberTable.role })
        .from(businessMemberTable)
        .where(
          and(
            eq(businessMemberTable.businessId, businessId),
            eq(businessMemberTable.userId, userId),
          ),
        );
      if (!row) return null;
      return { role: row.role as BusinessMemberRole };
    });
  }

  export async function listForUser(userId: string): Promise<z.infer<typeof Info>[]> {
    return withTransaction(async (tx) => {
      const rows = await tx
        .select({ business: businessTable })
        .from(businessMemberTable)
        .innerJoin(businessTable, eq(businessMemberTable.businessId, businessTable.id))
        .where(eq(businessMemberTable.userId, userId))
        .orderBy(desc(businessTable.updatedAt));
      return rows.map((r) => serializeBusiness(r.business));
    });
  }

  export const byId = fn(z.string(), async (id) => {
    return withTransaction(async (tx) => {
      const [row] = await tx.select().from(businessTable).where(eq(businessTable.id, id));
      return row ? serializeBusiness(row) : undefined;
    });
  });

  export const create = fn(CreateInput, async (input) => {
    return createTransaction(async (tx) => {
      const businessId = createID("business");
      const memberId = createID("business_member");
      const [biz] = await tx
        .insert(businessTable)
        .values({
          id: businessId,
          name: input.name,
          slug: input.slug ?? null,
          timezone: input.timezone ?? "UTC",
        })
        .returning();
      if (!biz) throw new Error("Failed to create business");
      await tx.insert(businessMemberTable).values({
        id: memberId,
        businessId,
        userId: input.ownerUserId,
        role: "owner",
      });
      return serializeBusiness(biz);
    });
  });

  export const update = fn(UpdateInput, async (input) => {
    return createTransaction(async (tx) => {
      const { id, ...patch } = input;
      const [row] = await tx
        .update(businessTable)
        .set({
          ...("name" in patch && patch.name !== undefined ? { name: patch.name } : {}),
          ...("slug" in patch ? { slug: patch.slug ?? null } : {}),
          ...("timezone" in patch && patch.timezone !== undefined
            ? { timezone: patch.timezone }
            : {}),
        })
        .where(eq(businessTable.id, id))
        .returning();
      if (!row) throw new NotFoundError("Business", id);
      return serializeBusiness(row);
    });
  });

  export async function listMembers(businessId: string): Promise<z.infer<typeof MemberInfo>[]> {
    return withTransaction(async (tx) => {
      const rows = await tx
        .select({
          member: businessMemberTable,
          email: userTable.email,
          name: userTable.name,
        })
        .from(businessMemberTable)
        .innerJoin(userTable, eq(businessMemberTable.userId, userTable.id))
        .where(eq(businessMemberTable.businessId, businessId))
        .orderBy(desc(businessMemberTable.createdAt));
      return rows.map((r) => ({
        id: r.member.id,
        businessId: r.member.businessId,
        userId: r.member.userId,
        userEmail: r.email,
        userName: r.name,
        role: r.member.role as "owner" | "manager" | "cashier",
        createdAt: r.member.createdAt,
        updatedAt: r.member.updatedAt,
      }));
    });
  }

  export const addMemberByEmail = fn(AddMemberInput, async (input) => {
    return createTransaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(userTable)
        .where(eq(userTable.email, input.userEmail));
      if (!user) throw new NotFoundError("User", input.userEmail);

      const [existing] = await tx
        .select()
        .from(businessMemberTable)
        .where(
          and(
            eq(businessMemberTable.businessId, input.businessId),
            eq(businessMemberTable.userId, user.id),
          ),
        );
      if (existing) {
        throw new VisibleError(
          "validation",
          ErrorCodes.Validation.ALREADY_EXISTS,
          "User is already a member of this business",
        );
      }

      const id = createID("business_member");
      const [row] = await tx
        .insert(businessMemberTable)
        .values({
          id,
          businessId: input.businessId,
          userId: user.id,
          role: input.role,
        })
        .returning();
      if (!row) throw new Error("Failed to add member");
      return {
        id: row.id,
        businessId: row.businessId,
        userId: row.userId,
        userEmail: user.email,
        userName: user.name,
        role: row.role as "owner" | "manager" | "cashier",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  });

  export const removeMember = fn(
    z.object({ businessId: z.string(), memberUserId: z.string() }),
    async ({ businessId, memberUserId }) => {
      return createTransaction(async (tx) => {
        const owners = await tx
          .select()
          .from(businessMemberTable)
          .where(
            and(
              eq(businessMemberTable.businessId, businessId),
              eq(businessMemberTable.role, "owner"),
            ),
          );
        if (owners.length === 1 && owners[0]!.userId === memberUserId) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Cannot remove the last owner of a business",
          );
        }
        const [row] = await tx
          .delete(businessMemberTable)
          .where(
            and(
              eq(businessMemberTable.businessId, businessId),
              eq(businessMemberTable.userId, memberUserId),
            ),
          )
          .returning();
        if (!row) throw new NotFoundError("BusinessMember", memberUserId);
      });
    },
  );

  export const updateMemberRole = fn(UpdateMemberRoleInput, async (input) => {
    return createTransaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(businessMemberTable)
        .where(
          and(
            eq(businessMemberTable.businessId, input.businessId),
            eq(businessMemberTable.userId, input.memberUserId),
          ),
        );
      if (!current) throw new NotFoundError("BusinessMember", input.memberUserId);

      if (current.role === "owner" && input.role !== "owner") {
        const ownerCount = await tx
          .select()
          .from(businessMemberTable)
          .where(
            and(
              eq(businessMemberTable.businessId, input.businessId),
              eq(businessMemberTable.role, "owner"),
            ),
          );
        if (ownerCount.length <= 1) {
          throw new VisibleError(
            "validation",
            ErrorCodes.Validation.INVALID_STATE,
            "Cannot demote the only owner",
          );
        }
      }

      const [row] = await tx
        .update(businessMemberTable)
        .set({ role: input.role })
        .where(
          and(
            eq(businessMemberTable.businessId, input.businessId),
            eq(businessMemberTable.userId, input.memberUserId),
          ),
        )
        .returning();
      if (!row) throw new NotFoundError("BusinessMember", input.memberUserId);
      const [user] = await tx.select().from(userTable).where(eq(userTable.id, row.userId));
      return {
        id: row.id,
        businessId: row.businessId,
        userId: row.userId,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
        role: row.role as "owner" | "manager" | "cashier",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  });

  export async function assertMember(
    businessId: string,
    userId: string,
  ): Promise<BusinessMemberRole> {
    const m = await membership(businessId, userId);
    if (!m) {
      throw new VisibleError(
        "forbidden",
        ErrorCodes.Permission.FORBIDDEN,
        "You do not have access to this business",
      );
    }
    return m.role;
  }
}
