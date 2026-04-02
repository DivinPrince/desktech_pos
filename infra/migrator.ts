import "./sst-ion-globals";
import { allSecrets } from "./secret";

const migrator = new sst.aws.Function("DatabaseMigrator", {
  handler: "./packages/core/src/drizzle/migrator.handler",
  timeout: "120 seconds",
  memory: "512 MB",
  link: [...allSecrets],
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
