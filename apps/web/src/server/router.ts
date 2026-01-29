import { router } from "./trpc.js";
import { tenantRouter } from "./routers/tenant.js";
import { connectionRouter } from "./routers/connection.js";
import { agentRouter } from "./routers/agent.js";

export const appRouter = router({
  tenant: tenantRouter,
  connection: connectionRouter,
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
