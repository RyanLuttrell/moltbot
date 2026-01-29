/**
 * Integration registry — defines third-party tool integrations the agent can use.
 */

export interface IntegrationCapability {
  id: string;
  label: string;
  description: string;
}

export type IntegrationAuthMethod = "oauth" | "apiKey";

export interface IntegrationDefinition {
  id: string;
  label: string;
  description: string;
  /** Phosphor icon name */
  icon: string;
  category: string;
  authMethod: IntegrationAuthMethod;
  /** Path to initiate the OAuth flow (authMethod === "oauth") */
  oauthPath?: string;
  /** Placeholder text for API key input (authMethod === "apiKey") */
  apiKeyPlaceholder?: string;
  /** Help URL for obtaining credentials */
  apiKeyHelpUrl?: string;
  /** OAuth scopes to request */
  scopes: string[];
  capabilities: IntegrationCapability[];
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "google",
    label: "Google",
    description: "Gmail and Google Calendar access for your agent",
    icon: "GoogleLogo",
    category: "productivity",
    authMethod: "oauth",
    oauthPath: "/api/auth/google",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    capabilities: [
      {
        id: "gmail",
        label: "Gmail",
        description: "Read and send emails",
      },
      {
        id: "gcal",
        label: "Google Calendar",
        description: "Read and create calendar events",
      },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    description: "Access repositories, issues, and pull requests",
    icon: "GithubLogo",
    category: "developer",
    authMethod: "oauth",
    scopes: [],
    capabilities: [
      {
        id: "repos",
        label: "Repositories",
        description: "Read repository contents and metadata",
      },
    ],
  },
  {
    id: "notion",
    label: "Notion",
    description: "Search and update Notion pages and databases",
    icon: "NotePencil",
    category: "productivity",
    authMethod: "oauth",
    scopes: [],
    capabilities: [
      {
        id: "pages",
        label: "Pages",
        description: "Read and update Notion pages",
      },
    ],
  },
  {
    id: "linear",
    label: "Linear",
    description: "Manage issues, projects, and cycles",
    icon: "Kanban",
    category: "developer",
    authMethod: "apiKey",
    apiKeyPlaceholder: "lin_api_...",
    apiKeyHelpUrl: "https://linear.app/settings/api",
    scopes: [],
    capabilities: [
      {
        id: "issues",
        label: "Issues",
        description: "Create and update Linear issues",
      },
      {
        id: "projects",
        label: "Projects",
        description: "View and manage projects",
      },
    ],
  },
];

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}
