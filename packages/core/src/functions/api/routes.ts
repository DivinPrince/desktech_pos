import { auth } from "@repo/core/auth";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { businessScopedApi, businessesRootApi } from "./businesses";
import { handleError, type AppEnv, sessionMiddleware } from "./common";
import { usersApi } from "./users";

const apiRoutes = new Hono<AppEnv>()
  .get("/", (c) =>
    c.json({
      name: "@repo/core",
      status: "ok",
      routes: [
        "/api/auth/*",
        "/api/users",
        "/api/businesses",
        "/api/businesses/:businessId/*",
      ],
    }),
  )
  .get("/doc", (c) =>
    c.json({
      name: "@repo/core",
      version: "0.0.1",
      note: "Route inventory. Add OpenAPI when your API grows.",
      groups: {
        auth: "/api/auth/*",
        users: "/api/users",
        businesses: "/api/businesses",
        businessScoped: "/api/businesses/:businessId",
      },
    }),
  )
  .route("/businesses", businessesRootApi)
  .route("/businesses/:businessId", businessScopedApi)
  .route("/users", usersApi);

export const app = new Hono<AppEnv>();

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:8081",
  process.env.ADMIN_URL || "http://localhost:3001",
  "http://localhost:8081",
];

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
  }),
);
app.use("/api/*", sessionMiddleware);

app.get("/", (c) =>
  c.json({ name: "api", status: "ok", docs: "/api", health: "/api/" }),
);
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));
app.route("/api", apiRoutes);
app.onError(handleError);

export { apiRoutes };
