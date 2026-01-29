import { router } from "./trpc";
import { tenantRouter } from "./routers/tenant";
import { connectionRouter } from "./routers/connection";
import { agentRouter } from "./routers/agent";
import { usageRouter } from "./routers/usage";
import { billingRouter } from "./routers/billing";
import { chatRouter } from "./routers/chat";

export const appRouter = router({
  tenant: tenantRouter,
  connection: connectionRouter,
  agent: agentRouter,
  usage: usageRouter,
  billing: billingRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
