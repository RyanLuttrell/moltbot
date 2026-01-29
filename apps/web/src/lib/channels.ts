/**
 * Channel registry — defines how each channel connects and what it needs.
 */

export type ChannelAuthMethod = "oauth" | "token" | "qr";

export interface ChannelDefinition {
  id: string;
  label: string;
  description: string;
  authMethod: ChannelAuthMethod;
  /** For OAuth channels: the path to initiate the flow */
  oauthPath?: string;
  /** For token channels: placeholder text for the input */
  tokenPlaceholder?: string;
  /** Tier 1 = simple auth, Tier 2 = persistent session */
  tier: 1 | 2;
}

export const CHANNELS: ChannelDefinition[] = [
  {
    id: "slack",
    label: "Slack",
    description: "Connect a Slack workspace via OAuth",
    authMethod: "oauth",
    oauthPath: "/api/auth/slack",
    tier: 1,
  },
  {
    id: "discord",
    label: "Discord",
    description: "Add a Discord bot with a bot token",
    authMethod: "token",
    tokenPlaceholder: "Bot token from discord.com/developers",
    tier: 1,
  },
  {
    id: "telegram",
    label: "Telegram",
    description: "Connect a Telegram bot via BotFather token",
    authMethod: "token",
    tokenPlaceholder: "Token from @BotFather",
    tier: 1,
  },
  {
    id: "googlechat",
    label: "Google Chat",
    description: "Connect via Google Workspace service account",
    authMethod: "token",
    tokenPlaceholder: "Service account JSON key",
    tier: 1,
  },
  {
    id: "msteams",
    label: "Microsoft Teams",
    description: "Connect via Azure Bot registration",
    authMethod: "token",
    tokenPlaceholder: "Azure Bot app ID and secret",
    tier: 1,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    description: "Scan a QR code to link your WhatsApp",
    authMethod: "qr",
    tier: 2,
  },
  {
    id: "signal",
    label: "Signal",
    description: "Link as a Signal device",
    authMethod: "qr",
    tier: 2,
  },
  {
    id: "matrix",
    label: "Matrix",
    description: "Connect with a Matrix homeserver account",
    authMethod: "token",
    tokenPlaceholder: "Homeserver URL and access token",
    tier: 2,
  },
];

export function getChannel(id: string): ChannelDefinition | undefined {
  return CHANNELS.find((ch) => ch.id === id);
}
