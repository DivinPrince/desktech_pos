import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../../src/functions/api/routes";
import { getTestHelpers, saveUserAndTrack } from "../helpers/auth-context";
import { jsonHeaders } from "../helpers/headers";
import { readJson } from "../helpers/http";

describe("API /api/users (full)", () => {
  const garbage = { userIds: [] as string[] };
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

  it("GET /me 401 without session", async () => {
    const res = await app.request("http://localhost/api/users/me", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("GET /me 200 with session", async () => {
    const helpers = await getTestHelpers();
    const user = await saveUserAndTrack(
      helpers,
      { email: `me-${runId}@example.com`, name: "Me" },
      garbage,
    );
    const headers = await helpers.getAuthHeaders({ userId: user.id });
    const res = await app.request("http://localhost/api/users/me", { method: "GET", headers });
    const body = await readJson<{ data: { id: string; email: string } }>(res, 200);
    expect(body.data.id).toBe(user.id);
  });

  it("PUT /me updates profile", async () => {
    const helpers = await getTestHelpers();
    const user = await saveUserAndTrack(
      helpers,
      { email: `me-put-${runId}@example.com`, name: "Before" },
      garbage,
    );
    const headers = await helpers.getAuthHeaders({ userId: user.id });
    const res = await app.request("http://localhost/api/users/me", {
      method: "PUT",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ name: "After Name" }),
    });
    const body = await readJson<{ data: { name: string } }>(res, 200);
    expect(body.data.name).toBe("After Name");
  });

  it("GET /users 403 for non-admin", async () => {
    const helpers = await getTestHelpers();
    const user = await saveUserAndTrack(
      helpers,
      { email: `nu-${runId}@example.com`, name: "U" },
      garbage,
    );
    const headers = await helpers.getAuthHeaders({ userId: user.id });
    const res = await app.request("http://localhost/api/users", { method: "GET", headers });
    expect(res.status).toBe(403);
  });

  it("GET /users 200 for admin with query params", async () => {
    const helpers = await getTestHelpers();
    const admin = await saveUserAndTrack(
      helpers,
      { email: `adm-${runId}@example.com`, name: "Admin", role: "admin" },
      garbage,
    );
    const headers = await helpers.getAuthHeaders({ userId: admin.id });
    const res = await app.request(
      `http://localhost/api/users?limit=5&offset=0&role=user`,
      { method: "GET", headers },
    );
    const body = await readJson<{ data: unknown[] }>(res, 200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("POST /users creates user (admin)", async () => {
    const helpers = await getTestHelpers();
    const admin = await saveUserAndTrack(
      helpers,
      { email: `adm2-${runId}@example.com`, name: "Admin2", role: "admin" },
      garbage,
    );
    const headers = await helpers.getAuthHeaders({ userId: admin.id });
    const newEmail = `created-${runId}@example.com`;
    const res = await app.request("http://localhost/api/users", {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({
        name: "Created User",
        email: newEmail,
        password: "password12345",
        role: "user",
      }),
    });
    const body = await readJson<{ data: { id: string; email: string } }>(res, 201);
    expect(body.data.email).toBe(newEmail);
    garbage.userIds.push(body.data.id);
  });

  it("GET /users/:id 200 and 404", async () => {
    const helpers = await getTestHelpers();
    const admin = await saveUserAndTrack(
      helpers,
      { email: `adm3-${runId}@example.com`, name: "Admin3", role: "admin" },
      garbage,
    );
    const target = await saveUserAndTrack(
      helpers,
      { email: `tgt-${runId}@example.com`, name: "Target" },
      garbage,
    );
    const headers = await helpers.getAuthHeaders({ userId: admin.id });
    const ok = await app.request(`http://localhost/api/users/${target.id}`, {
      method: "GET",
      headers,
    });
    await readJson(ok, 200);

    const missing = await app.request("http://localhost/api/users/usr_nonexistent_000000000000", {
      method: "GET",
      headers,
    });
    expect(missing.status).toBe(404);
  });

  it("PUT /users/:id updates user (admin)", async () => {
    const helpers = await getTestHelpers();
    const admin = await saveUserAndTrack(
      helpers,
      { email: `adm4-${runId}@example.com`, name: "Admin4", role: "admin" },
      garbage,
    );
    const target = await saveUserAndTrack(
      helpers,
      { email: `tgt2-${runId}@example.com`, name: "T2" },
      garbage,
    );
    const headers = await helpers.getAuthHeaders({ userId: admin.id });
    const res = await app.request(`http://localhost/api/users/${target.id}`, {
      method: "PUT",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ name: "Updated By Admin" }),
    });
    const body = await readJson<{ data: { name: string } }>(res, 200);
    expect(body.data.name).toBe("Updated By Admin");
  });
});
