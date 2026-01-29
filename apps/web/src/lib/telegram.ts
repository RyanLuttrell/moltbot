/**
 * Telegram Bot API helpers for webhook-based bot integration.
 */

const API_BASE = "https://api.telegram.org/bot";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function tgApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(`Telegram API ${method}: ${data.description ?? "unknown error"}`);
  }
  return data.result!;
}

/** Validate a bot token and return bot info. */
export async function telegramGetMe(token: string): Promise<TelegramUser> {
  return tgApi<TelegramUser>(token, "getMe");
}

/** Register a webhook URL with Telegram. */
export async function telegramSetWebhook(
  token: string,
  url: string,
  secretToken: string,
): Promise<void> {
  await tgApi(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
  });
}

/** Remove the webhook for a bot. */
export async function telegramDeleteWebhook(token: string): Promise<void> {
  await tgApi(token, "deleteWebhook");
}

/** Send a text message to a Telegram chat. */
export async function telegramSendMessage(
  token: string,
  chatId: number | string,
  text: string,
  replyToMessageId?: number,
): Promise<void> {
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    ...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId } } : {}),
  });
}
