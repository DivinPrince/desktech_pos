import type { TestHelpers } from "better-auth/plugins";
import { app } from "../../src/functions/api/routes";
import { saveUserAndTrack } from "./auth-context";
import { jsonHeaders } from "./headers";
import { readJson } from "./http";

export type UserGarbage = { userIds: string[] };

export type SeededBusiness = {
  businessId: string;
  owner: { id: string; email: string };
  manager: { id: string; email: string };
  cashier: { id: string; email: string };
  outsider: { id: string; email: string };
  ownerHeaders: Headers;
  managerHeaders: Headers;
  cashierHeaders: Headers;
  outsiderHeaders: Headers;
};

export async function seedBusinessWithTeam(
  helpers: TestHelpers,
  garbage: UserGarbage,
  runId: string,
): Promise<SeededBusiness> {
  const owner = await saveUserAndTrack(
    helpers,
    { email: `owner-${runId}@example.com`, name: "Owner" },
    garbage,
  );

  const ownerHeaders = await helpers.getAuthHeaders({ userId: owner.id });

  const bizRes = await app.request("http://localhost/api/businesses", {
    method: "POST",
    headers: jsonHeaders(ownerHeaders),
    body: JSON.stringify({
      name: `Integration ${runId}`,
      slug: `biz-${runId}`,
      currency: "USD",
      timezone: "UTC",
    }),
  });
  const { data: biz } = await readJson<{ data: { id: string } }>(bizRes, 201);

  const manager = await saveUserAndTrack(
    helpers,
    { email: `mgr-${runId}@example.com`, name: "Manager" },
    garbage,
  );
  const cashier = await saveUserAndTrack(
    helpers,
    { email: `csh-${runId}@example.com`, name: "Cashier" },
    garbage,
  );
  const outsider = await saveUserAndTrack(
    helpers,
    { email: `out-${runId}@example.com`, name: "Outsider" },
    garbage,
  );

  const m1 = await app.request(`http://localhost/api/businesses/${biz.id}/members`, {
    method: "POST",
    headers: jsonHeaders(ownerHeaders),
    body: JSON.stringify({ userEmail: manager.email, role: "manager" }),
  });
  await readJson(m1, 201);

  const m2 = await app.request(`http://localhost/api/businesses/${biz.id}/members`, {
    method: "POST",
    headers: jsonHeaders(ownerHeaders),
    body: JSON.stringify({ userEmail: cashier.email, role: "cashier" }),
  });
  await readJson(m2, 201);

  const managerHeaders = await helpers.getAuthHeaders({ userId: manager.id });
  const cashierHeaders = await helpers.getAuthHeaders({ userId: cashier.id });
  const outsiderHeaders = await helpers.getAuthHeaders({ userId: outsider.id });

  return {
    businessId: biz.id,
    owner: { id: owner.id, email: owner.email },
    manager: { id: manager.id, email: manager.email },
    cashier: { id: cashier.id, email: cashier.email },
    outsider: { id: outsider.id, email: outsider.email },
    ownerHeaders,
    managerHeaders,
    cashierHeaders,
    outsiderHeaders,
  };
}
