import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/functions/api/routes";
import { getTestHelpers, saveUserAndTrack } from "../helpers/auth-context";
import { seedBusinessWithTeam, type UserGarbage } from "../helpers/business-fixture";
import { jsonHeaders } from "../helpers/headers";
import { readJson } from "../helpers/http";

describe("API /api/businesses (full)", () => {
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

  it("GET /businesses 401 unauthenticated", async () => {
    const res = await app.request("http://localhost/api/businesses", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("POST + GET business root", async () => {
    const helpers = await getTestHelpers();
    const owner = await saveUserAndTrack(
      helpers,
      { email: `br-${runId}@example.com`, name: "BR" },
      garbage,
    );
    const h = await helpers.getAuthHeaders({ userId: owner.id });
    const slug = `slug-br-${runId}`;
    const post = await app.request("http://localhost/api/businesses", {
      method: "POST",
      headers: jsonHeaders(h),
      body: JSON.stringify({ name: "BR Co", slug, currency: "USD" }),
    });
    const { data: biz } = await readJson<{ data: { id: string } }>(post, 201);

    const list = await app.request("http://localhost/api/businesses", { method: "GET", headers: h });
    const body = await readJson<{ data: { id: string }[] }>(list, 200);
    expect(body.data.some((b) => b.id === biz.id)).toBe(true);
  });

  it("GET /:businessId 200 for member, 403 for outsider", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `fx1-${runId}`);

    const ok = await app.request(`http://localhost/api/businesses/${fx.businessId}`, {
      method: "GET",
      headers: fx.ownerHeaders,
    });
    await readJson(ok, 200);

    const bad = await app.request(`http://localhost/api/businesses/${fx.businessId}`, {
      method: "GET",
      headers: fx.outsiderHeaders,
    });
    expect(bad.status).toBe(403);
  });

  it("PATCH business: manager OK, cashier 403", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `fx2-${runId}`);

    const mgrPatch = await app.request(`http://localhost/api/businesses/${fx.businessId}`, {
      method: "PATCH",
      headers: jsonHeaders(fx.managerHeaders),
      body: JSON.stringify({ name: "Renamed By Manager" }),
    });
    await readJson(mgrPatch, 200);

    const cashPatch = await app.request(`http://localhost/api/businesses/${fx.businessId}`, {
      method: "PATCH",
      headers: jsonHeaders(fx.cashierHeaders),
      body: JSON.stringify({ name: "No" }),
    });
    expect(cashPatch.status).toBe(403);
  });

  it("GET /members: manager OK, cashier 403", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `fx3-${runId}`);

    const ok = await app.request(`http://localhost/api/businesses/${fx.businessId}/members`, {
      method: "GET",
      headers: fx.managerHeaders,
    });
    const body = await readJson<{ data: unknown[] }>(ok, 200);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    const bad = await app.request(`http://localhost/api/businesses/${fx.businessId}/members`, {
      method: "GET",
      headers: fx.cashierHeaders,
    });
    expect(bad.status).toBe(403);
  });

  it("POST /members owner only; manager forbidden", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `fx4-${runId}`);
    const newbie = await saveUserAndTrack(
      helpers,
      { email: `new-${runId}@example.com`, name: "New" },
      garbage,
    );

    const mgrTry = await app.request(`http://localhost/api/businesses/${fx.businessId}/members`, {
      method: "POST",
      headers: jsonHeaders(fx.managerHeaders),
      body: JSON.stringify({ userEmail: newbie.email, role: "cashier" }),
    });
    expect(mgrTry.status).toBe(403);

    const ownerOk = await app.request(`http://localhost/api/businesses/${fx.businessId}/members`, {
      method: "POST",
      headers: jsonHeaders(fx.ownerHeaders),
      body: JSON.stringify({ userEmail: newbie.email, role: "cashier" }),
    });
    await readJson(ownerOk, 201);
  });

  it("PATCH /members/:userId role (owner)", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `fx5-${runId}`);

    const res = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/members/${fx.cashier.id}`,
      {
        method: "PATCH",
        headers: jsonHeaders(fx.ownerHeaders),
        body: JSON.stringify({ role: "manager" }),
      },
    );
    const body = await readJson<{ data: { role: string } }>(res, 200);
    expect(body.data.role).toBe("manager");
  });

  it("dedupes duplicate business slug with a random suffix", async () => {
    const helpers = await getTestHelpers();
    const owner = await saveUserAndTrack(
      helpers,
      { email: `slug-own-${runId}@example.com`, name: "SO" },
      garbage,
    );
    const h = await helpers.getAuthHeaders({ userId: owner.id });
    const sharedSlug = `shared-slug-${runId}`;

    const first = await app.request("http://localhost/api/businesses", {
      method: "POST",
      headers: jsonHeaders(h),
      body: JSON.stringify({ name: "First", slug: sharedSlug, currency: "USD" }),
    });
    const { data: firstBiz } = await readJson<{ data: { slug: string } }>(first, 201);

    const second = await app.request("http://localhost/api/businesses", {
      method: "POST",
      headers: jsonHeaders(h),
      body: JSON.stringify({ name: "Second", slug: sharedSlug.toUpperCase(), currency: "USD" }),
    });
    const { data: secondBiz } = await readJson<{ data: { slug: string } }>(second, 201);
    expect(secondBiz.slug).not.toBe(firstBiz.slug);
    expect(secondBiz.slug.startsWith(`${sharedSlug.toLowerCase()}-`)).toBe(true);
  });

  it("PATCH business rejects slug taken by another business", async () => {
    const helpers = await getTestHelpers();
    const owner = await saveUserAndTrack(
      helpers,
      { email: `slug-patch-${runId}@example.com`, name: "SP" },
      garbage,
    );
    const h = await helpers.getAuthHeaders({ userId: owner.id });
    const slugA = `slug-a-${runId}`;
    const slugB = `slug-b-${runId}`;

    const b1 = await app.request("http://localhost/api/businesses", {
      method: "POST",
      headers: jsonHeaders(h),
      body: JSON.stringify({ name: "B1", slug: slugA, currency: "USD" }),
    });
    await readJson(b1, 201);

    const b2 = await app.request("http://localhost/api/businesses", {
      method: "POST",
      headers: jsonHeaders(h),
      body: JSON.stringify({ name: "B2", slug: slugB, currency: "USD" }),
    });
    const { data: biz2 } = await readJson<{ data: { id: string } }>(b2, 201);

    const clash = await app.request(`http://localhost/api/businesses/${biz2.id}`, {
      method: "PATCH",
      headers: jsonHeaders(h),
      body: JSON.stringify({ slug: slugA }),
    });
    expect(clash.status).toBe(400);
  });

  it("DELETE /members/:userId (owner removes extra cashier)", async () => {
    const helpers = await getTestHelpers();
    const fx = await seedBusinessWithTeam(helpers, garbage, `fx6-${runId}`);
    const extra = await saveUserAndTrack(
      helpers,
      { email: `extra-${runId}@example.com`, name: "Extra" },
      garbage,
    );

    const add = await app.request(`http://localhost/api/businesses/${fx.businessId}/members`, {
      method: "POST",
      headers: jsonHeaders(fx.ownerHeaders),
      body: JSON.stringify({ userEmail: extra.email, role: "cashier" }),
    });
    await readJson(add, 201);

    const del = await app.request(
      `http://localhost/api/businesses/${fx.businessId}/members/${extra.id}`,
      {
        method: "DELETE",
        headers: fx.ownerHeaders,
      },
    );
    await readJson(del, 200);
  });
});
