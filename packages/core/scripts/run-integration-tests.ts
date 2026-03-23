/**
 * Starts Postgres via Docker Compose when DATABASE_URL is unset **or** points at the local test DB
 * (127.0.0.1 / localhost on port 54329, database `desktech_test`). That way `.env.test` in the shell
 * does not skip Compose while the container is stopped.
 *
 * For Neon or other remote URLs, Compose is not started; migrate + Vitest use your DATABASE_URL.
 *
 * Requires Docker Desktop running locally for the compose path.
 *
 * Manual (PowerShell): `set` does NOT set env vars — use:
 *   bun run test:db:up
 *   bun run test:migrate
 *   bun run exec-vitest run
 * Or: $env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54329/desktech_test'
 * Vitest loads `.env.test` when DATABASE_URL is unset (still need DB running on 54329).
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = resolve(root, "docker-compose.test.yml");
const composeProject = "desktech-core-test";
const testDbPort = 54329;
const defaultTestDatabaseUrl = `postgresql://postgres:postgres@127.0.0.1:${testDbPort}/desktech_test`;

/** True when this URL is the Docker Compose test Postgres (so we must ensure the stack is up). */
function isLocalDockerTestDatabaseUrl(url: string): boolean {
  try {
    const normalized = url.trim().replace(/^postgres:\/\//i, "postgresql://");
    const u = new URL(normalized);
    if (u.protocol !== "postgresql:") return false;
    const host = u.hostname.toLowerCase();
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      return false;
    }
    const port = u.port || "5432";
    if (port !== String(testDbPort)) return false;
    const db = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return db === "desktech_test";
  } catch {
    return false;
  }
}

function dockerCompose(args: string[]): number {
  const result = spawnSync(
    "docker",
    ["compose", "-p", composeProject, "-f", composeFile, ...args],
    {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

async function waitForPostgresReady(timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = spawnSync(
      "docker",
      [
        "compose",
        "-p",
        composeProject,
        "-f",
        composeFile,
        "exec",
        "-T",
        "postgres-test",
        "pg_isready",
        "-U",
        "postgres",
        "-d",
        "desktech_test",
      ],
      { cwd: root, stdio: "pipe" },
    );
    if (r.status === 0) return;
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(
    `Postgres did not become ready within ${timeoutMs}ms. Check: docker compose -p ${composeProject} -f docker-compose.test.yml logs`,
  );
}

async function main(): Promise<void> {
  let databaseUrl = process.env.DATABASE_URL?.trim();
  let startedCompose = false;

  const useLocalCompose = !databaseUrl || isLocalDockerTestDatabaseUrl(databaseUrl);

  if (useLocalCompose) {
    console.log(
      databaseUrl
        ? "DATABASE_URL is the local Docker test DB; starting / ensuring Docker Compose…"
        : "DATABASE_URL not set; starting Postgres with Docker Compose…",
    );
    let up = dockerCompose(["up", "-d", "--wait"]);
    if (up !== 0) {
      up = dockerCompose(["up", "-d"]);
    }
    if (up !== 0) {
      console.error(
        "\nCould not run `docker compose`. Fix:\n" +
          "  1. Install Docker Desktop for Windows and start it.\n" +
          "  2. Ensure `docker` works in this terminal (try: docker version).\n" +
          "  Or set DATABASE_URL to an existing Postgres URL and run again.\n",
      );
      process.exit(1);
    }
    startedCompose = true;
    databaseUrl = defaultTestDatabaseUrl;
    try {
      await waitForPostgresReady();
    } catch (e) {
      console.error(e);
      dockerCompose(["down", "-v"]);
      process.exit(1);
    }
    console.log(`Postgres is ready at ${databaseUrl}\n`);
  }

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    AUTH_TEST_UTILS: "1",
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ?? "test-better-auth-secret-min-32-chars!!",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost",
    FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:3000",
    ADMIN_URL: process.env.ADMIN_URL ?? "http://localhost:3001",
    NODE_ENV: "test",
  };

  let exitCode = 0;
  try {
    const migrate = spawnSync(process.execPath, [resolve(root, "src/drizzle/migrate.ts")], {
      cwd: root,
      env,
      stdio: "inherit",
    });

    if (migrate.status !== 0) {
      exitCode = migrate.status ?? 1;
    } else {
      const vitestArgs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["run"];
      const vitest = spawnSync(process.execPath, ["run", "exec-vitest", "--", ...vitestArgs], {
        cwd: root,
        env,
        stdio: "inherit",
      });
      exitCode = vitest.status ?? 1;
    }
  } finally {
    if (startedCompose) {
      console.log("\nStopping test Postgres (docker compose down -v)…");
      dockerCompose(["down", "-v"]);
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
