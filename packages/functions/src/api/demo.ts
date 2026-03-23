import { DemoService } from "@repo/core/demo";
import { Hono } from "hono";
import { z } from "zod";
import {
  type AppEnv,
  assertOwnerOrAdmin,
  notFound,
  ok,
  requireAuth,
  success,
  validate,
} from "./common";

const idParamSchema = z.object({
  id: z.string(),
});

const createBodySchema = DemoService.CreateInput.omit({ userId: true });

export const demoApi = new Hono<AppEnv>()
  .get("/", async (c) => ok(c, await DemoService.list()))
  .post("/", requireAuth, validate("json", createBodySchema), async (c) => {
    const user = c.get("user")!;
    const row = await DemoService.create({
      ...c.req.valid("json"),
      userId: user.id,
    });
    return ok(c, row, 201);
  })
  .get("/:id", validate("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const row = await DemoService.byId(id);
    if (!row) {
      throw notFound("DemoItem", id);
    }
    return ok(c, row);
  })
  .delete("/:id", requireAuth, validate("param", idParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const row = await DemoService.byId(id);
    if (!row) {
      throw notFound("DemoItem", id);
    }
    assertOwnerOrAdmin(row.createdByUserId);
    await DemoService.remove(id);
    return success(c);
  });
