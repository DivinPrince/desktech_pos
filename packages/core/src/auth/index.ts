import "../../sst-env.d.ts";
import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, openAPI, bearer } from "better-auth/plugins";
import { dash } from "@better-auth/infra";
import { createOnboardingStep, onboarding } from "@better-auth-extended/onboarding";
import { db } from "../drizzle";
import { BusinessService } from "../business";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  isEmailConfigured,
} from "../email";
import { ac, adminRole, userRole } from "./permissions";
import {
  userTable,
  sessionTable,
  accountTable,
  verificationTable,
  jwksTable,
} from "../user/user.sql";
import { createID } from "../util/id";

const authOptions = {
  basePath: "/api/auth",
  trustedOrigins: [process.env.FRONTEND_URL || ""],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: userTable,
      session: sessionTable,
      account: accountTable,
      verification: verificationTable,
      jwks: jwksTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: isEmailConfigured,
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      await sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: isEmailConfigured,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: {
      generateId: (options: { model?: string } | undefined) => {
        const model = options?.model;
        if (model === "jwks") return createID("jwt");
        if (model && ["user", "session", "account", "verification"].includes(model)) {
          return createID(model as Parameters<typeof createID>[0]);
        }
        return createID("user");
      },
    },
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      partitioned: process.env.NODE_ENV === "production",
    },
  },
  user: {
    additionalFields: {
      phone: {
        type: "string" as const,
        required: false,
      },
    },
  },
  plugins: [
    bearer(),
    admin({
      ac,
      roles: {
        admin: adminRole,
        user: userRole,
      },
    }),
    openAPI({
      disableDefaultReference: true,
    }),
    onboarding({
      steps: {
        firstBusiness: createOnboardingStep({
          input: BusinessService.CreateInput.omit({ ownerUserId: true }),
          required: true,
          once: true,
          async handler(ctx) {
            const userId = ctx.context.session!.user.id;
            return BusinessService.create({
              name: ctx.body.name,
              slug: ctx.body.slug,
              timezone: ctx.body.timezone,
              ownerUserId: userId,
            });
          },
        }),
      },
      completionStep: "firstBusiness",
    }) as unknown as BetterAuthPlugin,
    dash(),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
export type SessionData = Session["session"];
