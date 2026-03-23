import { describe, it, expect } from "vitest";
import { app } from "../../src/functions/api/routes";
import { readJson } from "../helpers/http";

describe("Meta & API index", () => {
  it("GET / returns API health payload", async () => {
    const res = await app.request("http://localhost/", { method: "GET" });
    const body = await readJson<{ name: string; status: string; docs: string }>(res, 200);
    expect(body.status).toBe("ok");
    expect(body.docs).toBe("/api");
  });

  it("GET /api lists route groups", async () => {
    const res = await app.request("http://localhost/api", { method: "GET" });
    const body = await readJson<{ status: string; routes: string[] }>(res, 200);
    expect(body.status).toBe("ok");
    expect(body.routes).toContain("/api/auth/*");
    expect(body.routes).toContain("/api/users");
    expect(body.routes).toContain("/api/businesses");
  });

  it("GET /api/doc returns route inventory", async () => {
    const res = await app.request("http://localhost/api/doc", { method: "GET" });
    const body = await readJson<{ groups: Record<string, string> }>(res, 200);
    expect(body.groups.auth).toContain("/api/auth");
    expect(body.groups.businessScoped).toBeDefined();
  });
});
