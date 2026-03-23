import { handle, streamHandle } from "hono/aws-lambda";
import { app, apiRoutes } from "./api/app";

export type Routes = typeof apiRoutes;
export { app };

export const handler = process.env.SST_DEV ? handle(app) : streamHandle(app);
