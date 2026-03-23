import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/functions/api/routes";
import { getTestHelpers } from "../helpers/auth-context";
import { seedBusinessWithTeam, type UserGarbage } from "../helpers/business-fixture";
import { jsonHeaders } from "../helpers/headers";
import { readJson } from "../helpers/http";

describe("Dining, sales, expenses, reports, alerts", () => {
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

  it("dining tables CRUD", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `din-${runId}`);

    const post = await app.request(`http://localhost/api/businesses/${fx.businessId}/tables`, {
      method: "POST",
      headers: jsonHeaders(fx.managerHeaders),
      body: JSON.stringify({ label: "T1", capacity: 4, floorZone: "Main" }),
    });
    const { data: tbl } = await readJson<{ data: { id: string; label: string } }>(post, 201);

    const list = await app.request(`http://localhost/api/businesses/${fx.businessId}/tables`, {
      method: "GET",
      headers: fx.cashierHeaders,
    });
    const listed = await readJson<{ data: { id: string }[] }>(list, 200);
    expect(listed.data.some((t) => t.id === tbl.id)).toBe(true);

    const one = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/tables/${tbl.id}`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    await readJson(one, 200);

    const missing = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/tables/tbl_missing_000000000000`,
      { method: "GET", headers: fx.managerHeaders },
    );
    expect(missing.status).toBe(404);

    const patch = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/tables/${tbl.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ label: "T1-renamed" }),
      },
    );
    await readJson(patch, 200);

    const del = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/tables/${tbl.id}`,
      { method: "DELETE", headers: fx.managerHeaders },
    );
    await readJson(del, 200);
  });

  it("sales: list (manager), get, draft lines complete, void draft; cashier void rules", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `sal-${runId}`);

    const prodRes = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/products`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ name: "Item", priceCents: 100, trackStock: false }),
      },
    );
    const { data: prod } = await readJson<{ data: { id: string } }>(prodRes, 201);

    const draft = await app.request(`http://localhost/api/businesses/${fx.businessId}/sales`, {
      method: "POST",
      headers: jsonHeaders(fx.cashierHeaders),
      body: JSON.stringify({}),
    });
    const { data: sale } = await readJson<{ data: { id: string; status: string } }>(draft, 201);
    expect(sale.status).toBe("draft");

    const list = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales?status=draft&limit=10`,
      { method: "GET", headers: fx.managerHeaders },
    );
    await readJson(list, 200);

    const getOne = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale.id}`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    await readJson(getOne, 200);

    const lines = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale.id}/lines`,
      {
        method: "PUT",
        headers: jsonHeaders(fx.cashierHeaders),
        body: JSON.stringify({
          lines: [{ productId: prod.id, quantity: 1 }],
        }),
      },
    );
    await readJson(lines, 200);

    const complete = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale.id}/complete`,
      {
        method: "POST",
        headers: jsonHeaders(fx.cashierHeaders),
        body: JSON.stringify({ paymentMethod: "card" }),
      },
    );
    await readJson(complete, 200);

    const draft2 = await app.request(`http://localhost/api/businesses/${fx.businessId}/sales`, {
      method: "POST",
      headers: jsonHeaders(fx.managerHeaders),
      body: JSON.stringify({}),
    });
    const { data: sale2 } = await readJson<{ data: { id: string } }>(draft2, 201);

    const voidDraft = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale2.id}/void`,
      {
        method: "POST",
        headers: jsonHeaders(fx.cashierHeaders),
        body: JSON.stringify({ reason: "mistake" }),
      },
    );
    await readJson(voidDraft, 200);

    const completedAgain = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({}),
      },
    );
    const { data: sale3 } = await readJson<{ data: { id: string } }>(completedAgain, 201);
    await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale3.id}/lines`,
      {
        method: "PUT",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ lines: [{ productId: prod.id, quantity: 1 }] }),
      },
    );
    await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale3.id}/complete`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ paymentMethod: "cash" }),
      },
    );

    const voidBlocked = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale3.id}/void`,
      {
        method: "POST",
        headers: jsonHeaders(fx.cashierHeaders),
        body: JSON.stringify({ reason: "should fail" }),
      },
    );
    expect(voidBlocked.status).toBe(403);

    const voidOk = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/${sale3.id}/void`,
      {
        method: "POST",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ reason: "manager void" }),
      },
    );
    await readJson(voidOk, 200);

    const missingSale = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/sales/sal_missing_000000000000`,
      { method: "GET", headers: fx.managerHeaders },
    );
    expect(missingSale.status).toBe(404);
  });

  it("expenses CRUD", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `exp-${runId}`);

    const spent = new Date().toISOString();
    const post = await app.request(`http://localhost/api/businesses/${fx.businessId}/expenses`, {
      method: "POST",
      headers: jsonHeaders(fx.cashierHeaders),
      body: JSON.stringify({
        category: "supplies",
        amountCents: 2500,
        spentAt: spent,
        note: "paper",
      }),
    });
    const { data: exp } = await readJson<{ data: { id: string } }>(post, 201);

    const cashList = await app.request(`http://localhost/api/businesses/${fx.businessId}/expenses`, {
      method: "GET",
      headers: fx.cashierHeaders,
    });
    expect(cashList.status).toBe(403);

    const list = await app.request(`http://localhost/api/businesses/${fx.businessId}/expenses`, {
      method: "GET",
      headers: fx.managerHeaders,
    });
    const listed = await readJson<{ data: { id: string }[] }>(list, 200);
    expect(listed.data.some((e) => e.id === exp.id)).toBe(true);

    const one = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/expenses/${exp.id}`,
      { method: "GET", headers: fx.managerHeaders },
    );
    await readJson(one, 200);

    const patch = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/expenses/${exp.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(fx.managerHeaders),
        body: JSON.stringify({ note: "updated note" }),
      },
    );
    await readJson(patch, 200);

    const del = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/expenses/${exp.id}`,
      { method: "DELETE", headers: fx.managerHeaders },
    );
    await readJson(del, 200);
  });

  it("reports sales-summary and product-sales", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `rep-${runId}`);

    const from = "2020-01-01T00:00:00.000Z";
    const to = "2030-12-31T23:59:59.999Z";

    const s1 = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/reports/sales-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { method: "GET", headers: fx.managerHeaders },
    );
    await readJson(s1, 200);

    const s2 = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/reports/product-sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { method: "GET", headers: fx.managerHeaders },
    );
    await readJson(s2, 200);

    const cashRep = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/reports/sales-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    expect(cashRep.status).toBe(403);
  });

  it("alerts low-stock and expired-batches", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `alr-${runId}`);

    const low = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/alerts/low-stock`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    await readJson(low, 200);

    const exp = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/alerts/expired-batches`,
      { method: "GET", headers: fx.managerHeaders },
    );
    await readJson(exp, 200);

    const cashExp = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/alerts/expired-batches`,
      { method: "GET", headers: fx.cashierHeaders },
    );
    expect(cashExp.status).toBe(403);
  });

  it("GET /sales forbidden for cashier", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `sl2-${runId}`);

    const res = await app.request(`http://localhost/api/businesses/${fx.businessId}/sales`, {
      method: "GET",
      headers: fx.cashierHeaders,
    });
    expect(res.status).toBe(403);
  });
});
