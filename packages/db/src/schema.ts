import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    clerkOrgId: text("clerk_org_id"),
    name: text("name"),
    email: text("email"),
    plan: text("plan").notNull().default("free"), // free | pro | enterprise
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tenants_clerk_user_id_idx").on(t.clerkUserId),
    index("tenants_stripe_customer_id_idx").on(t.stripeCustomerId),
  ],
);

// ---------------------------------------------------------------------------
// Tenant configuration (replaces per-user YAML config)
// ---------------------------------------------------------------------------

export const tenantConfigs = pgTable(
  "tenant_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    config: jsonb("config").notNull().default({}),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tenant_configs_tenant_id_idx").on(t.tenantId)],
);

// ---------------------------------------------------------------------------
// Channel connections
// ---------------------------------------------------------------------------

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(), // slack, discord, telegram, whatsapp, ...
    label: text("label"), // user-facing name ("My Slack workspace")
    status: text("status").notNull().default("pending"), // pending | active | error | disconnected
    credentialsEnc: text("credentials_enc"), // AES-256-GCM encrypted JSON
    metadata: jsonb("metadata").default({}),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("connections_tenant_id_idx").on(t.tenantId),
    index("connections_channel_id_idx").on(t.channelId),
  ],
);

// ---------------------------------------------------------------------------
// Agents per tenant
// ---------------------------------------------------------------------------

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(), // user-facing identifier
    name: text("name"),
    systemPrompt: text("system_prompt"),
    model: text("model").notNull().default("claude-sonnet-4-20250514"),
    modelProvider: text("model_provider").notNull().default("anthropic"), // anthropic | openai | byok
    toolsPolicy: jsonb("tools_policy").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("agents_tenant_id_idx").on(t.tenantId),
    uniqueIndex("agents_tenant_slug_idx").on(t.tenantId, t.slug),
  ],
);

// ---------------------------------------------------------------------------
// Gateway workers (Fly.io Machines)
// ---------------------------------------------------------------------------

export const gatewayWorkers = pgTable(
  "gateway_workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    flyMachineId: text("fly_machine_id"),
    flyAppName: text("fly_app_name"),
    status: text("status").notNull().default("stopped"), // starting | running | stopped | error
    region: text("region").default("iad"),
    lastHeartbeat: timestamp("last_heartbeat"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("gateway_workers_tenant_id_idx").on(t.tenantId),
    index("gateway_workers_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Usage tracking (for billing + analytics)
// ---------------------------------------------------------------------------

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    agentSlug: text("agent_slug"),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    channelId: text("channel_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("usage_records_tenant_id_idx").on(t.tenantId),
    index("usage_records_created_at_idx").on(t.createdAt),
    index("usage_records_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// API keys (programmatic access)
// ---------------------------------------------------------------------------

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    keyPrefix: text("key_prefix").notNull(), // first 8 chars for identification
    keyHash: text("key_hash").notNull().unique(), // SHA-256 of full key
    label: text("label"),
    scopes: jsonb("scopes").default([]),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("api_keys_tenant_id_idx").on(t.tenantId),
    uniqueIndex("api_keys_key_hash_idx").on(t.keyHash),
  ],
);

// ---------------------------------------------------------------------------
// Dashboard chat messages (browser-based agent conversations)
// ---------------------------------------------------------------------------

export const dashboardMessages = pgTable(
  "dashboard_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // "user" | "assistant"
    content: text("content").notNull(),
    model: text("model"), // only for assistant messages
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("dashboard_messages_tenant_id_idx").on(t.tenantId),
    index("dashboard_messages_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // tenant.created, connection.added, agent.updated, ...
    actorId: text("actor_id"), // clerk user ID or "system"
    resourceType: text("resource_type"), // connection, agent, config, ...
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_tenant_id_idx").on(t.tenantId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);
