#!/usr/bin/env bun
/**
 * CLI script to create a default admin user programmatically
 *
 * Usage:
 *   bun run create-admin
 *   bun run create-admin --email admin@example.com --password secret123 --name "Admin User"
 *
 * Environment variables (used as defaults):
 *   ADMIN_EMAIL - Default admin email
 *   ADMIN_PASSWORD - Default admin password
 *   ADMIN_NAME - Default admin name
 */

import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db } from "../drizzle";
import { userTable, accountTable } from "../user/user.sql";
import { createID } from "../util/id";

// Parse command line arguments
function parseArgs(): { email: string; password: string; name: string } {
  const args = process.argv.slice(2);
  let email = process.env.ADMIN_EMAIL || "admin@example.com";
  let password = process.env.ADMIN_PASSWORD || "";
  let name = process.env.ADMIN_NAME || "Admin";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if ((arg === "--email" || arg === "-e") && next) {
      email = next;
      i++;
    } else if ((arg === "--password" || arg === "-p") && next) {
      password = next;
      i++;
    } else if ((arg === "--name" || arg === "-n") && next) {
      name = next;
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { email, password, name };
}

function printHelp(): void {
  console.log(`
Create admin user (Better Auth credential account)

Usage:
  bun run create-admin [options]

Options:
  -e, --email <email>       Admin email (default: ADMIN_EMAIL env or admin@example.com)
  -p, --password <password> Admin password (default: ADMIN_PASSWORD env, required)
  -n, --name <name>         Admin name (default: ADMIN_NAME env or "Admin")
  -h, --help                Show this help message

Examples:
  bun run create-admin --email admin@example.com --password secret123
  bun run create-admin -e admin@example.com -p secret123 -n "Super Admin"

Environment variables:
  ADMIN_EMAIL     - Default admin email
  ADMIN_PASSWORD  - Default admin password
  ADMIN_NAME      - Default admin name
  DATABASE_URL    - PostgreSQL connection string (required)
`);
}

async function createAdmin(): Promise<void> {
  const { email, password, name } = parseArgs();

  // Validate inputs
  if (!email) {
    console.error(
      "Error: Email is required. Use --email or set ADMIN_EMAIL env variable.",
    );
    process.exit(1);
  }

  if (!password) {
    console.error(
      "Error: Password is required. Use --password or set ADMIN_PASSWORD env variable.",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  console.log(`Creating admin user: ${email}`);

  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    if (existingUser) {
      // Update existing user to admin role
      if (existingUser.role === "admin") {
        console.log(`User ${email} is already an admin.`);
        process.exit(0);
      }

      const result = await db
        .update(userTable)
        .set({
          role: "admin",
          name: name,
          emailVerified: true,
        })
        .where(eq(userTable.id, existingUser.id))
        .returning();

      const updatedUser = result[0];
      if (!updatedUser) {
        console.error("Error: Failed to update user.");
        process.exit(1);
      }

      console.log(`Updated existing user to admin role:`);
      console.log(`  ID: ${updatedUser.id}`);
      console.log(`  Email: ${updatedUser.email}`);
      console.log(`  Name: ${updatedUser.name}`);
      console.log(`  Role: ${updatedUser.role}`);
      process.exit(0);
    }

    // Create new admin user
    const userId = createID("user");
    const accountId = createID("account");
    const hashedPassword = await hashPassword(password);

    // Insert user
    const insertResult = await db
      .insert(userTable)
      .values({
        id: userId,
        email,
        name,
        role: "admin",
        emailVerified: true,
      })
      .returning();

    const newUser = insertResult[0];
    if (!newUser) {
      console.error("Error: Failed to create user.");
      process.exit(1);
    }

    // Insert account with password (for email/password auth)
    await db.insert(accountTable).values({
      id: accountId,
      userId: userId,
      accountId: userId, // Self-reference for credential accounts
      providerId: "credential",
      password: hashedPassword,
    });

    console.log(`\nAdmin user created successfully:`);
    console.log(`  ID: ${newUser.id}`);
    console.log(`  Email: ${newUser.email}`);
    console.log(`  Name: ${newUser.name}`);
    console.log(`  Role: ${newUser.role}`);
    console.log(`\nYou can now log in with these credentials.`);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
createAdmin();
