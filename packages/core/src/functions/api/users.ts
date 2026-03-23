import { Actor } from "@repo/core/actor";
import { UserService } from "@repo/core/user";
import { Hono } from "hono";
import { z } from "zod";
import {
  type AppEnv,
  notFound,
  ok,
  parseIntegerParam,
  requireAdmin,
  requireAuth,
  validate,
} from "./common";

const userIdSchema = z.object({
  id: z.string(),
});

const userListQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["admin", "user"]).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const updateProfileSchema = UserService.UpdateInput.omit({
  id: true,
  role: true,
});

const createUserSchema = UserService.CreateInput;

const updateUserSchema = UserService.UpdateInput.omit({
  id: true,
});

async function getCurrentUser() {
  const user = await UserService.byId(Actor.userID());
  if (!user) {
    throw notFound("User", Actor.userID());
  }
  return user;
}

const meApi = new Hono<AppEnv>()
  .use("*", requireAuth)
  .get("/", async (c) => ok(c, await getCurrentUser()))
  .put("/", validate("json", updateProfileSchema), async (c) => {
    const user = await UserService.update({
      id: Actor.userID(),
      ...c.req.valid("json"),
    });
    return ok(c, user);
  });

export const usersApi = new Hono<AppEnv>()
  .route("/me", meApi)
  .get("/", requireAdmin, validate("query", userListQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const users = await UserService.list({
      search: query.search,
      role: query.role,
      limit: parseIntegerParam(query.limit),
      offset: parseIntegerParam(query.offset),
    });
    return ok(c, users);
  })
  .post("/", requireAdmin, validate("json", createUserSchema), async (c) => {
    const user = await UserService.create(c.req.valid("json"));
    return ok(c, user, 201);
  })
  .get("/:id", requireAdmin, validate("param", userIdSchema), async (c) => {
    const { id } = c.req.valid("param");
    const user = await UserService.byId(id);
    if (!user) {
      throw notFound("User", id);
    }
    return ok(c, user);
  })
  .put(
    "/:id",
    requireAdmin,
    validate("param", userIdSchema),
    validate("json", updateUserSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = await UserService.update({
        id,
        ...c.req.valid("json"),
      });
      return ok(c, user);
    },
  );
