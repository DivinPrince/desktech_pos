/// <reference path="./sst-ion-globals.d.ts" />
import { secret } from "./secret";

const migrator = new sst.aws.Function("DatabaseMigrator", {
  handler: "./packages/core/src/drizzle/migrator.handler",
  timeout: "120 seconds",
  memory: "512 MB",
  link: [secret.DatabaseUrl],
  nodejs: {
    install: ["pg"],
  },
  environment: {
    DATABASE_URL: secret.DatabaseUrl.value,
  },
  copyFiles: [
    {
      from: "packages/core/migrations",
      to: "./migrations",
    },
  ],
});

if (!$dev) {
  new aws.lambda.Invocation("DatabaseMigratorInvocation", {
    input: Date.now().toString(),
    functionName: migrator.name,
  });
}
