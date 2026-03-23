import "./sst-ion-globals";
import { neonDatabase } from "./neon";

const migrator = new sst.aws.Function("DatabaseMigrator", {
  handler: "./packages/core/src/drizzle/migrator.handler",
  timeout: "120 seconds",
  memory: "512 MB",
  link: [neonDatabase],
  nodejs: {
    install: ["pg"],
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
