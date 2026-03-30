import { BusinessService, businessRoleAtLeast } from "@repo/core/business";
import {
  AlertService,
  CategoryService,
  DiningService,
  ExpenseService,
  InventoryService,
  OfflineIdempotencyService,
  ProductService,
  ProductVariantService,
  ReportService,
  SaleService,
} from "@repo/core/pos";
import { Hono } from "hono";
import { z } from "zod";
import {
  type AppEnv,
  notFound,
  ok,
  parseIntegerParam,
  requireAuth,
  requireBusinessMembership,
  requireBusinessMinimum,
  success,
  validate,
} from "./common";
import { ErrorCodes, VisibleError } from "@repo/core/error";

const idParam = z.object({
  id: z.string(),
});

const productAndVariantParams = z.object({
  productId: z.string(),
  variantId: z.string(),
});

const createBusinessBody = BusinessService.CreateInput.omit({ ownerUserId: true });
const updateBusinessBody = BusinessService.UpdateInput.omit({ id: true });

function uid(c: { get: (k: "user") => AppEnv["Variables"]["user"] }) {
  return c.get("user")!.id;
}

/** Routes mounted at /businesses — list/create without :businessId. */
export const businessesRootApi = new Hono<AppEnv>()
  .use(requireAuth)
  .get("/", async (c) => ok(c, await BusinessService.listForUser(uid(c))))
  .post("/", validate("json", createBusinessBody), async (c) => {
    const row = await BusinessService.create({
      ...c.req.valid("json"),
      ownerUserId: uid(c),
    });
    return ok(c, row, 201);
  });

/** Routes mounted at /businesses/:businessId — membership required. */
export const businessScopedApi = new Hono<AppEnv>()
  .use(requireAuth, requireBusinessMembership)
  .get("/", async (c) => {
    const id = c.req.param("businessId")!;
    const row = await BusinessService.byId(id);
    if (!row) throw notFound("Business", id);
    return ok(c, row);
  })
  .post("/select", async (c) => {
    const businessId = c.req.param("businessId")!;
    const row = await BusinessService.rememberLastUsed(uid(c), businessId);
    return ok(c, row);
  })
  .patch(
    "/",
    requireBusinessMinimum("manager"),
    validate("json", updateBusinessBody),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const row = await BusinessService.update({
        id: businessId,
        ...c.req.valid("json"),
      });
      return ok(c, row);
    },
  )
  .get("/members", requireBusinessMinimum("manager"), async (c) => {
    const businessId = c.req.param("businessId")!;
    return ok(c, await BusinessService.listMembers(businessId));
  })
  .post(
    "/members",
    requireBusinessMinimum("owner"),
    validate(
      "json",
      BusinessService.AddMemberInput.omit({ businessId: true }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      return ok(
        c,
        await BusinessService.addMemberByEmail({
          businessId,
          ...c.req.valid("json"),
        }),
        201,
      );
    },
  )
  .patch(
    "/members/:userId",
    requireBusinessMinimum("owner"),
    validate("param", z.object({ userId: z.string() })),
    validate("json", z.object({ role: z.enum(["owner", "manager", "cashier"]) })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { userId } = c.req.valid("param");
      return ok(
        c,
        await BusinessService.updateMemberRole({
          businessId,
          memberUserId: userId,
          role: c.req.valid("json").role,
        }),
      );
    },
  )
  .delete(
    "/members/:userId",
    requireBusinessMinimum("owner"),
    validate("param", z.object({ userId: z.string() })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { userId } = c.req.valid("param");
      await BusinessService.removeMember({ businessId, memberUserId: userId });
      return success(c);
    },
  )
  .get("/categories", async (c) => {
    const businessId = c.req.param("businessId")!;
    return ok(c, await CategoryService.list(businessId));
  })
  .post(
    "/categories",
    requireBusinessMinimum("manager"),
    validate("json", CategoryService.CreateInput.omit({ businessId: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      return ok(
        c,
        await CategoryService.create({
          businessId,
          ...c.req.valid("json"),
        }),
        201,
      );
    },
  )
  .patch(
    "/categories/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    validate("json", CategoryService.UpdateInput.omit({ businessId: true, id: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      return ok(
        c,
        await CategoryService.update({
          businessId,
          id,
          ...c.req.valid("json"),
        }),
      );
    },
  )
  .delete(
    "/categories/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      await CategoryService.remove({ businessId, id });
      return success(c);
    },
  )
  .get(
    "/products",
    validate(
      "query",
      z.object({
        search: z.string().optional(),
        categoryId: z.string().optional(),
        activeOnly: z.enum(["true", "false"]).optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const q = c.req.valid("query");
      return ok(
        c,
        await ProductService.list({
          businessId,
          search: q.search,
          categoryId: q.categoryId,
          activeOnly: q.activeOnly === "true",
        }),
      );
    },
  )
  .get("/products/:id", validate("param", idParam), async (c) => {
    const businessId = c.req.param("businessId")!;
    const { id } = c.req.valid("param");
    const row = await ProductService.byId({ businessId, id });
    if (!row) throw notFound("Product", id);
    return ok(c, row);
  })
  .post(
    "/products",
    requireBusinessMinimum("manager"),
    validate("json", ProductService.CreateInput.omit({ businessId: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const idempotencyKey = c.req.header("Idempotency-Key")?.trim();
      const userId = uid(c);
      if (idempotencyKey) {
        const cached = await OfflineIdempotencyService.lookupCachedProductCreate({
          userId,
          businessId,
          idempotencyKey,
        });
        if (cached) return ok(c, cached, 201);
      }
      const row = await ProductService.create({
        businessId,
        ...c.req.valid("json"),
      });
      if (idempotencyKey) {
        try {
          await OfflineIdempotencyService.saveProductCreateResult({
            userId,
            businessId,
            idempotencyKey,
            product: row,
          });
        } catch {
          // Unique race: original creator already stored the replay payload.
        }
      }
      return ok(c, row, 201);
    },
  )
  .patch(
    "/products/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    validate("json", ProductService.UpdateInput.omit({ businessId: true, id: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      return ok(
        c,
        await ProductService.update({
          businessId,
          id,
          ...c.req.valid("json"),
        }),
      );
    },
  )
  .delete(
    "/products/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      await ProductService.remove({ businessId, id });
      return success(c);
    },
  )
  .post(
    "/products/:productId/variants",
    requireBusinessMinimum("manager"),
    validate("param", z.object({ productId: z.string() })),
    validate("json", ProductVariantService.CreateInput.omit({ businessId: true, productId: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { productId } = c.req.valid("param");
      return ok(
        c,
        await ProductVariantService.create({
          businessId,
          productId,
          ...c.req.valid("json"),
        }),
        201,
      );
    },
  )
  .patch(
    "/products/:productId/variants/:variantId",
    requireBusinessMinimum("manager"),
    validate("param", productAndVariantParams),
    validate("json", ProductVariantService.UpdateInput.omit({ businessId: true, productId: true, id: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { productId, variantId } = c.req.valid("param");
      return ok(
        c,
        await ProductVariantService.update({
          businessId,
          productId,
          id: variantId,
          ...c.req.valid("json"),
        }),
      );
    },
  )
  .delete(
    "/products/:productId/variants/:variantId",
    requireBusinessMinimum("manager"),
    validate("param", productAndVariantParams),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { productId, variantId } = c.req.valid("param");
      await ProductVariantService.remove({ businessId, productId, id: variantId });
      return success(c);
    },
  )
  .get(
    "/stock/movements",
    requireBusinessMinimum("manager"),
    validate(
      "query",
      z.object({
        productId: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.string().optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const q = c.req.valid("query");
      return ok(
        c,
        await InventoryService.listMovements({
          businessId,
          productId: q.productId,
          from: q.from ? new Date(q.from) : undefined,
          to: q.to ? new Date(q.to) : undefined,
          limit: parseIntegerParam(q.limit),
        }),
      );
    },
  )
  .post(
    "/stock/adjust",
    requireBusinessMinimum("manager"),
    validate(
      "json",
      z.object({
        productId: z.string(),
        productVariantId: z.string().optional(),
        quantityDelta: z.number().int(),
        type: z.enum([
          "adjustment",
          "purchase",
          "waste",
          "sale",
          "sale_return",
          "transfer_in",
          "transfer_out",
        ]),
        note: z.string().max(2000).optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      return ok(
        c,
        await InventoryService.adjustStock({
          businessId,
          userId: uid(c),
          ...c.req.valid("json"),
        }),
        201,
      );
    },
  )
  .get("/batches", requireBusinessMinimum("manager"), async (c) => {
    const businessId = c.req.param("businessId")!;
    const productId = c.req.query("productId");
    return ok(c, await InventoryService.listBatches({ businessId, productId }));
  })
  .post(
    "/batches",
    requireBusinessMinimum("manager"),
    validate(
      "json",
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        expiresOn: z.string(),
        lotCode: z.string().max(64).optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const body = c.req.valid("json");
      return ok(
        c,
        await InventoryService.receiveBatch({
          businessId,
          userId: uid(c),
          productId: body.productId,
          quantity: body.quantity,
          expiresOn: new Date(body.expiresOn),
          lotCode: body.lotCode,
        }),
        201,
      );
    },
  )
  .patch(
    "/batches/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    validate(
      "json",
      z.object({
        quantityDelta: z.number().int(),
        note: z.string().max(2000).optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      return ok(
        c,
        await InventoryService.adjustBatchQuantity({
          businessId,
          batchId: id,
          userId: uid(c),
          ...c.req.valid("json"),
        }),
      );
    },
  )
  .get("/tables", async (c) => {
    const businessId = c.req.param("businessId")!;
    return ok(c, await DiningService.list(businessId));
  })
  .post(
    "/tables",
    requireBusinessMinimum("manager"),
    validate("json", DiningService.CreateInput.omit({ businessId: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      return ok(
        c,
        await DiningService.create({
          businessId,
          ...c.req.valid("json"),
        }),
        201,
      );
    },
  )
  .get("/tables/:id", validate("param", idParam), async (c) => {
    const businessId = c.req.param("businessId")!;
    const { id } = c.req.valid("param");
    const row = await DiningService.byId({ businessId, id });
    if (!row) throw notFound("DiningTable", id);
    return ok(c, row);
  })
  .patch(
    "/tables/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    validate("json", DiningService.UpdateInput.omit({ businessId: true, id: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      return ok(
        c,
        await DiningService.update({
          businessId,
          id,
          ...c.req.valid("json"),
        }),
      );
    },
  )
  .delete(
    "/tables/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      await DiningService.remove({ businessId, id });
      return success(c);
    },
  )
  .get(
    "/sales",
    requireBusinessMinimum("manager"),
    validate(
      "query",
      z.object({
        status: z.enum(["draft", "completed", "voided"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.string().optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const q = c.req.valid("query");
      return ok(
        c,
        await SaleService.list({
          businessId,
          status: q.status,
          from: q.from ? new Date(q.from) : undefined,
          to: q.to ? new Date(q.to) : undefined,
          limit: parseIntegerParam(q.limit),
        }),
      );
    },
  )
  .post(
    "/sales",
    validate(
      "json",
      z.object({
        tableId: z.string().optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      return ok(
        c,
        await SaleService.createDraft({
          businessId,
          userId: uid(c),
          ...c.req.valid("json"),
        }),
        201,
      );
    },
  )
  .get("/sales/:id", validate("param", idParam), async (c) => {
    const businessId = c.req.param("businessId")!;
    const { id } = c.req.valid("param");
    const row = await SaleService.byId({ businessId, id });
    if (!row) throw notFound("Sale", id);
    return ok(c, row);
  })
  .put(
    "/sales/:id/lines",
    validate("param", idParam),
    validate(
      "json",
      z.object({
        lines: z.array(
          z.object({
            productId: z.string(),
            productVariantId: z.string().optional(),
            quantity: z.number().int().positive(),
            unitPriceCents: z.number().int().nonnegative().optional(),
            lineDiscountCents: z.number().int().nonnegative().optional(),
          }),
        ),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      return ok(
        c,
        await SaleService.setDraftLines({
          businessId,
          saleId: id,
          lines: c.req.valid("json").lines,
        }),
      );
    },
  )
  .post(
    "/sales/:id/complete",
    validate("param", idParam),
    validate(
      "json",
      z.object({
        paymentMethod: z.string().min(1).max(64),
        taxCents: z.number().int().nonnegative().optional(),
      }),
    ),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      return ok(
        c,
        await SaleService.complete({
          businessId,
          saleId: id,
          userId: uid(c),
          ...c.req.valid("json"),
        }),
      );
    },
  )
  .post(
    "/sales/:id/void",
    validate("param", idParam),
    validate("json", z.object({ reason: z.string().min(1).max(2000) })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      const sale = await SaleService.byId({ businessId, id });
      if (!sale) throw notFound("Sale", id);
      const role = c.get("businessRole")!;
      if (
        sale.status === "completed" &&
        !businessRoleAtLeast(role, "manager")
      ) {
        throw new VisibleError(
          "forbidden",
          ErrorCodes.Permission.INSUFFICIENT_PERMISSIONS,
          "Only managers or owners can void completed sales",
        );
      }
      return ok(
        c,
        await SaleService.voidSale({
          businessId,
          saleId: id,
          userId: uid(c),
          reason: c.req.valid("json").reason,
        }),
      );
    },
  )
  .get("/expenses", requireBusinessMinimum("manager"), async (c) => {
    const businessId = c.req.param("businessId")!;
    const from = c.req.query("from");
    const to = c.req.query("to");
    const category = c.req.query("category");
    const limit = c.req.query("limit");
    return ok(
      c,
      await ExpenseService.list({
        businessId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        category: category ?? undefined,
        limit: parseIntegerParam(limit),
      }),
    );
  })
  .post(
    "/expenses",
    validate("json", ExpenseService.CreateInput.omit({ businessId: true, userId: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      return ok(
        c,
        await ExpenseService.create({
          businessId,
          userId: uid(c),
          ...c.req.valid("json"),
        }),
        201,
      );
    },
  )
  .get("/expenses/:id", requireBusinessMinimum("manager"), validate("param", idParam), async (c) => {
    const businessId = c.req.param("businessId")!;
    const { id } = c.req.valid("param");
    const row = await ExpenseService.byId({ businessId, id });
    if (!row) throw notFound("Expense", id);
    return ok(c, row);
  })
  .patch(
    "/expenses/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    validate("json", ExpenseService.UpdateInput.omit({ businessId: true, id: true })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      return ok(
        c,
        await ExpenseService.update({
          businessId,
          id,
          ...c.req.valid("json"),
        }),
      );
    },
  )
  .delete(
    "/expenses/:id",
    requireBusinessMinimum("manager"),
    validate("param", idParam),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const { id } = c.req.valid("param");
      await ExpenseService.remove({ businessId, id });
      return success(c);
    },
  )
  .get(
    "/reports/sales-summary",
    requireBusinessMinimum("manager"),
    validate("query", z.object({ from: z.string(), to: z.string() })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const q = c.req.valid("query");
      return ok(
        c,
        await ReportService.salesSummary({
          businessId,
          from: new Date(q.from),
          to: new Date(q.to),
        }),
      );
    },
  )
  .get(
    "/reports/product-sales",
    requireBusinessMinimum("manager"),
    validate("query", z.object({ from: z.string(), to: z.string() })),
    async (c) => {
      const businessId = c.req.param("businessId")!;
      const q = c.req.valid("query");
      return ok(
        c,
        await ReportService.productSales({
          businessId,
          from: new Date(q.from),
          to: new Date(q.to),
        }),
      );
    },
  )
  .get("/alerts/low-stock", async (c) => {
    const businessId = c.req.param("businessId")!;
    return ok(c, await AlertService.lowStock({ businessId }));
  })
  .get("/alerts/expired-batches", requireBusinessMinimum("manager"), async (c) => {
    const businessId = c.req.param("businessId")!;
    return ok(c, await AlertService.expiredBatches({ businessId }));
  });
