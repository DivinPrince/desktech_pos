import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

export const handler = async () => {
  console.log("Running database migrations...");
  await migrate(db, {
    migrationsFolder: "./migrations",
  });
  console.log("Migrations complete.");
  return { statusCode: 200, body: "Migrations complete" };
};
