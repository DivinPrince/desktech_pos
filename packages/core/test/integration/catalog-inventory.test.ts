import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/functions/api/routes";
import { getTestHelpers } from "../helpers/auth-context";
import { seedBusinessWithTeam, type UserGarbage } from "../helpers/business-fixture";
import { jsonHeaders } from "../helpers/headers";
import { readJson } from "../helpers/http";

describe("Catalog, products & inventory", () => {
  const garbage: UserGarbage = { userIds: [] };
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  beforeAll(async () => {
    await getTestHelpers();
  });

  afterAll(async () => {
    const helpers = await getTestHelpers();
    for (const id of garbage.userIds) {
      await helpers.deleteUser(id).catch(() => {});
    }
  });

  it("categories CRUD + cashier forbidden on POST", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `cat-${runId}`);

    const cashPost = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/categories`,
      {
        method: "POST",
        headers: jsonHeaders(fx.cashierHeaders),
        body: JSON.stringify({ name: "X" }),
      },
    );
    expect(cashPost.status).toBe(403);

    const post = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/categories`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ name: "Drinks" }),
      },
    );
    const { data: cat } = await readJson<{ data: { id: string; name: string } }>(post, 201);

    const list = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/categories`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    const listed = await readJson<{ data: { id: string }[] }>(list, 200);
    expect(listed.data.some((c) => c.id === cat.id)).toBe(true);

    const patch = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/categories/${cat.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ name: "Soft drinks" }),
      },
    );
    const patched = await readJson<{ data: { name: string } }>(patch, 200);
    expect(patched.data.name).toBe("Soft drinks");

    const del = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/categories/${cat.id}`,
      { method: "DELETE", headers: fx.managerHeaders },
    );
    await readJson(del, 200);
  });

  it("products list, get, create, patch, 404", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `prd-${runId}`);

    const catPost = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/categories`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ name: "P Cat" }),
      },
    );
    const { data: cat } = await readJson<{ data: { id: string } }>(catPost, 201);

    const create = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "Widget",
          categoryId: cat.id,
          priceCents: 999,
          trackStock: false,
        }),
      },
    );
    const { data: prod } = await readJson<{ data: { id: string; name: string } }>(create, 201);

    const idemKey = `idem-catalog-${runId}`;
    const idemBody = JSON.stringify({
      name: "Idempotent SKU",
      priceCents: 4242,
    });
    const idemHdr = jsonHeaders(fx.managerHeaders);
    idemHdr.set("Idempotency-Key", idemKey);
    const idemFirst = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      { method: "POST", headers: idemHdr, body: idemBody },
    );
    const { data: idemProd } = await readJson<{ data: { id: string; name: string } }>(
      idemFirst,
      201,
    );
    const idemSecond = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      { method: "POST", headers: idemHdr, body: idemBody },
    );
    const { data: idemReplay } = await readJson<{ data: { id: string } }>(idemSecond, 201);
    expect(idemReplay.id).toBe(idemProd.id);

    const listQ = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products?search=Wid&activeOnly=true`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    const listed = await readJson<{ data: { id: string }[] }>(listQ, 200);
    expect(listed.data.some((p) => p.id === prod.id)).toBe(true);

    const one = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${prod.id}`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    await readJson(one, 200);

    const missing = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/pro_missing_0000000000000000`,
      { method: "GET", headers: fx.managerHeaders },
    );
    expect(missing.status).toBe(404);

    const patch = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${prod.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ name: "Widget Pro", sku: "W-1" }),
      },
    );
    const updated = await readJson<{ data: { name: string } }>(patch, 200);
    expect(updated.data.name).toBe("Widget Pro");

    const cashProd = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.cashierHeaders),
        body: JSON.stringify({ name: "Nope", priceCents: 1, trackStock: false }),
      },
    );
    expect(cashProd.status).toBe(403);

    const delProd = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${prod.id}`,
      { method: "DELETE", headers: fx.managerHeaders },
    );
    await readJson(delProd, 200);

    const gone = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${prod.id}`,
      { method: "GET", headers: fx.managerHeaders },
    );
    expect(gone.status).toBe(404);
  });

  it("product create defaults trackStock false and stockAlert 0; PATCH stockAlert", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `def-${runId}`);

    const create = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ name: "Defaults only", priceCents: 50 }),
      },
    );
    const { data: p } = await readJson<{
      data: { id: string; trackStock: boolean; stockAlert: number };
    }>(create, 201);
    expect(p.trackStock).toBe(false);
    expect(p.stockAlert).toBe(0);

    const patch = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${p.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ stockAlert: 12, trackStock: true }),
      },
    );
    const { data: updated } = await readJson<{
      data: { stockAlert: number; trackStock: boolean };
    }>(patch, 200);
    expect(updated.stockAlert).toBe(12);
    expect(updated.trackStock).toBe(true);
  });

  it("product create can set initial stock only when tracking is enabled", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `initstk-${runId}`);

    const createTracked = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "Tracked stock",
          priceCents: 250,
          trackStock: true,
          initialQuantity: 7,
        }),
      },
    );
    const { data: tracked } = await readJson<{
      data: { id: string; trackStock: boolean; quantityOnHand: number };
    }>(createTracked, 201);
    expect(tracked.trackStock).toBe(true);
    expect(tracked.quantityOnHand).toBe(7);

    const createUntracked = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "Untracked stock",
          priceCents: 250,
          trackStock: false,
          initialQuantity: 3,
        }),
      },
    );
    expect(createUntracked.status).toBe(400);
  });

  it("DELETE product forbidden when referenced on a sale", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `pdel-${runId}`);

    const prodRes = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ name: "Sold once", priceCents: 100, trackStock: false }),
      },
    );
    const { data: prod } = await readJson<{ data: { id: string } }>(prodRes, 201);

    const saleRes = await app.request(`http://localhost/api/businesses/${fx.businessId}/sales`, {
      method: "POST",
      headers: jsonHeaders(fx.managerHeaders),
      body: JSON.stringify({}),
    });
    const { data: sale } = await readJson<{ data: { id: string } }>(saleRes, 201);

    await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale.id}/lines`,
      {
        method: "PUT",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ lines: [{ productId: prod.id, quantity: 1 }] }),
      },
    );

    const del = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${prod.id}`,
      { method: "DELETE", headers: fx.managerHeaders },
    );
    expect(del.status).toBe(400);
  });

  it("stock movements, adjust; reject adjust when trackStock false", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `stk-${runId}`);

    const noTrack = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "Service",
          priceCents: 100,
          trackStock: false,
        }),
      },
    );
    const { data: p0 } = await readJson<{ data: { id: string } }>(noTrack, 201);

    const badAdj = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/stock/adjust`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          productId: p0.id,
          quantityDelta: 1,
          type: "adjustment",
        }),
      },
    );
    expect(badAdj.status).toBe(400);

    const tracked = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "Stocked",
          priceCents: 200,
          trackStock: true,
        }),
      },
    );
    const { data: p1 } = await readJson<{ data: { id: string } }>(tracked, 201);

    const adj = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/stock/adjust`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          productId: p1.id,
          quantityDelta: 7,
          type: "purchase",
          note: "delivery",
        }),
      },
    );
    const adjBody = await readJson<{
      data: { movement: { quantityDelta: number }; product: { id: string; quantityOnHand: number } };
    }>(adj, 201);
    expect(adjBody.data.movement.quantityDelta).toBe(7);
    expect(adjBody.data.product.id).toBe(p1.id);
    expect(adjBody.data.product.quantityOnHand).toBe(7);

    const mov = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/stock/movements?limit=5&productId=${encodeURIComponent(p1.id)}`,
      { method: "GET", headers: fx.managerHeaders },
    );
    const movements = await readJson<{ data: unknown[] }>(mov, 200);
    expect(movements.data.length).toBeGreaterThanOrEqual(1);

    const cashMov = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/stock/movements`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    expect(cashMov.status).toBe(403);

    const cashBatch = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/batches`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    expect(cashBatch.status).toBe(403);
  });

  it("batches receive, list, patch quantity", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `bat-${runId}`);

    const prodRes = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "Batchable",
          priceCents: 50,
          trackStock: true,
        }),
      },
    );
    const { data: prod } = await readJson<{ data: { id: string } }>(prodRes, 201);

    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    const batchPost = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/batches`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          productId: prod.id,
          quantity: 10,
          expiresOn: exp.toISOString(),
          lotCode: "LOT-A",
        }),
      },
    );
    const { data: batch } = await readJson<{ data: { id: string; quantity: number } }>(
      batchPost,
      201,
    );

    const list = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/batches?productId=${encodeURIComponent(prod.id)}`,
      { method: "GET", headers: fx.managerHeaders },
    );
    const batches = await readJson<{ data: { id: string }[] }>(list, 200);
    expect(batches.data.some((b) => b.id === batch.id)).toBe(true);

    const patch = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/batches/${batch.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ quantityDelta: -2, note: "shrink" }),
      },
    );
    await readJson(patch, 200);
  });

  it("product variants: create, stock adjust on variant, list includes variants", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `var-${runId}`);

    const prodRes = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "T-Shirt",
          priceCents: 1999,
          trackStock: true,
        }),
      },
    );
    const { data: prod } = await readJson<{ data: { id: string } }>(prodRes, 201);

    const baseAdj = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/stock/adjust`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          productId: prod.id,
          quantityDelta: 3,
          type: "purchase",
        }),
      },
    );
    await readJson(baseAdj, 201);

    const varRes = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${prod.id}/variants`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          name: "M",
          priceCents: 2199,
        }),
      },
    );
    const { data: variant } = await readJson<{ data: { id: string; quantityOnHand: number } }>(
      varRes,
      201,
    );
    expect(variant.quantityOnHand).toBe(3);

    const badBaseAdj = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/stock/adjust`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          productId: prod.id,
          quantityDelta: 1,
          type: "adjustment",
        }),
      },
    );
    expect(badBaseAdj.status).toBe(400);

    const varAdj = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/stock/adjust`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({
          productId: prod.id,
          productVariantId: variant.id,
          quantityDelta: 5,
          type: "purchase",
        }),
      },
    );
    const varAdjBody = await readJson<{
      data: {
        product: {
          quantityOnHand: number;
          variants: { id: string; quantityOnHand: number }[];
        };
      };
    }>(varAdj, 201);
    expect(varAdjBody.data.product.quantityOnHand).toBe(8);
    expect(varAdjBody.data.product.variants[0]!.quantityOnHand).toBe(8);

    const getProd = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products/${prod.id}`,
      { method: "GET", headers: fx.managerHeaders },
    );
    const one = await readJson<{
      data: {
        quantityOnHand: number;
        variants: { id: string; quantityOnHand: number }[];
      };
    }>(getProd, 200);
    expect(one.data.variants.length).toBe(1);
    const v0 = one.data.variants[0];
    expect(v0).toBeDefined();
    expect(v0!.quantityOnHand).toBe(8);
    expect(one.data.quantityOnHand).toBe(8);
  });
});
