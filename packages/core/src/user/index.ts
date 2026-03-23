import { eq, and, asc, like, count, SQL, or } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { withTransaction } from "../drizzle/transaction";
import { accountTable, userTable } from "./user.sql";
import { fn } from "../util/fn";
import { createID } from "../util/id";
import { ErrorCodes, NotFoundError, VisibleError } from "../error";

export * from "./user.sql";

export namespace UserService {
  export const Info = z
    .object({
      id: z.string().meta({ description: "User ID" }),
      name: z.string().meta({ description: "User's display name" }),
      email: z.string().meta({ description: "Email address" }),
      emailVerified: z
        .boolean()
        .meta({ description: "Whether email is verified" }),
      image: z
        .string()
        .nullable()
        .meta({ description: "Profile image URL" }),
      role: z.string().meta({ description: "User role (admin/user)" }),
      phone: z.string().nullable().meta({ description: "Phone number" }),
      banned: z
        .boolean()
        .nullable()
        .meta({ description: "Whether user is banned" }),
      createdAt: z.date().meta({ description: "Account creation date" }),
      updatedAt: z.date().meta({ description: "Last update date" }),
    })
    .meta({ ref: "User", description: "User account" });

  export const UpdateInput = z.object({
    id: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
    image: z.string().optional(),
    role: z.enum(["admin", "user"]).optional(),
  });

  export const CreateInput = z.object({
    name: z.string().min(1).max(255),
    email: z.email(),
    password: z.string().min(8),
    role: z.enum(["admin", "user"]).default("user"),
    phone: z.string().min(1).max(20).optional(),
  });

  export const ListInput = z.object({
    search: z.string().optional(),
    role: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
  });

  export async function hasAdmin(): Promise<boolean> {
    return withTransaction(async (tx) => {
      const [result] = await tx
        .select({ count: count() })
        .from(userTable)
        .where(eq(userTable.role, "admin"));
      return (result?.count ?? 0) > 0;
    });
  }

  export const byId = fn(z.string(), async (id) => {
    return withTransaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(userTable)
        .where(eq(userTable.id, id));
      return user ? serialize(user) : undefined;
    });
  });

  export const byEmail = fn(z.string(), async (email) => {
    return withTransaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(userTable)
        .where(eq(userTable.email, email));
      return user ? serialize(user) : undefined;
    });
  });

  export const list = fn(ListInput.optional(), async (input) => {
    return withTransaction(async (tx) => {
      const conditions: SQL<unknown>[] = [];

      if (input?.search) {
        conditions.push(
          or(
            like(userTable.email, `%${input.search}%`),
            like(userTable.name, `%${input.search}%`),
          )!,
        );
      }
      if (input?.role) {
        conditions.push(eq(userTable.role, input.role));
      }

      let query = tx.select().from(userTable).orderBy(asc(userTable.createdAt));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
      if (input?.limit) {
        query = query.limit(input.limit) as typeof query;
      }
      if (input?.offset) {
        query = query.offset(input.offset) as typeof query;
      }

      const users = await query;
      return users.map(serialize);
    });
  });

  export const create = fn(CreateInput, async (input) => {
    return withTransaction(async (tx) => {
      const [existingUser] = await tx
        .select()
        .from(userTable)
        .where(eq(userTable.email, input.email))
        .limit(1);

      if (existingUser) {
        throw new VisibleError(
          "validation",
          ErrorCodes.Validation.ALREADY_EXISTS,
          "A user with this email already exists.",
          "email",
        );
      }

      const userId = createID("user");
      const accountId = createID("account");
      const hashedPassword = await hashPassword(input.password);

      const [user] = await tx
        .insert(userTable)
        .values({
          id: userId,
          name: input.name,
          email: input.email,
          emailVerified: true,
          role: input.role,
          phone: input.phone,
        })
        .returning();

      if (!user) {
        throw new VisibleError(
          "internal",
          ErrorCodes.Server.INTERNAL_ERROR,
          "Failed to create user.",
        );
      }

      await tx.insert(accountTable).values({
        id: accountId,
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
      });

      return serialize(user);
    });
  });

  export const update = fn(UpdateInput, async (input) => {
    const { id, ...data } = input;
    return withTransaction(async (tx) => {
      const [user] = await tx
        .update(userTable)
        .set(data)
        .where(eq(userTable.id, id))
        .returning();
      if (!user) throw new NotFoundError("User", id);
      return serialize(user);
    });
  });

  function serialize(
    user: typeof userTable.$inferSelect,
  ): z.infer<typeof Info> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      phone: user.phone,
      banned: user.banned,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export type UserInfo = z.infer<typeof UserService.Info>;
export type UserCreateInput = z.infer<typeof UserService.CreateInput>;
export type UserUpdateInput = z.infer<typeof UserService.UpdateInput>;
