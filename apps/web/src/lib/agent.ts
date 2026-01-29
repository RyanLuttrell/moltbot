import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Be concise and direct in your responses.";

interface AgentConfig {
  model?: string | null;
  modelProvider?: string | null;
  systemPrompt?: string | null;
}

interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentResponse {
  content: string;
}

/**
 * Run a message through the AI agent and return the response.
 * For now, supports Anthropic only. BYOK + OpenAI support comes later.
 */
export async function runAgent(
  config: AgentConfig,
  messages: AgentMessage[],
): Promise<AgentResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: config.model ?? DEFAULT_MODEL,
    max_tokens: 4096,
    system: config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Extract text from the response
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return { content: text || "(no response)" };
}
