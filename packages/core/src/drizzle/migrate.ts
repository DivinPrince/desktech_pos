import { resolve } from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

const migrationsFolder = resolve(import.meta.dirname, "../../migrations");

console.log(`Running migrations from ${migrationsFolder}...`);

await migrate(db, { migrationsFolder });

console.log("Migrations complete.");
process.exit(0);
