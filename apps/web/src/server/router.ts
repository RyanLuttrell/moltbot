import { router } from "./trpc";
import { tenantRouter } from "./routers/tenant";
import { connectionRouter } from "./routers/connection";
import { agentRouter } from "./routers/agent";
import { usageRouter } from "./routers/usage";
import { billingRouter } from "./routers/billing";

export const appRouter = router({
  tenant: tenantRouter,
  connection: connectionRouter,
  agent: agentRouter,
  usage: usageRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
