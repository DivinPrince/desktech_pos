import type { TestHelpers } from "better-auth/plugins";
import { auth } from "@repo/core/auth";

type AuthContextWithTest = Awaited<typeof auth.$context> & { test: TestHelpers };

let cached: TestHelpers | undefined;

export async function getTestHelpers(): Promise<TestHelpers> {
  if (!cached) {
    const ctx = (await auth.$context) as AuthContextWithTest;
    if (!ctx.test) {
      throw new Error("Enable AUTH_TEST_UTILS=1 and the testUtils auth plugin for integration tests.");
    }
    cached = ctx.test;
  }
  return cached;
}

export async function saveUserAndTrack(
  helpers: TestHelpers,
  overrides: Parameters<TestHelpers["createUser"]>[0],
  garbage: { userIds: string[] },
) {
  const user = helpers.createUser(overrides);
  await helpers.saveUser(user);
  garbage.userIds.push(user.id);
  return user;
}
