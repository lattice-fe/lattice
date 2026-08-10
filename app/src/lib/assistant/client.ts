import { AssistantConfig } from "./config";

export const SYSTEM_PROMPT =
  "You are Watson, a refined and concise British desktop assistant inside Lattice file manager. Provide direct, accurate, and short answers with subtle British charm and wit, without filler, meta-commentary, or rambling preambles. For code or commands, provide just the snippet or command.";

export function resolveChatUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (url.endsWith("/chat/completions")) return url;
  if (!url.endsWith("/v1") && !url.includes("/v1/")) {
    url += "/v1";
  }
  return `${url}/chat/completions`;
}

export function parseResponseBody(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Received an empty response from the assistant API.");
  }

  // 1. Try standard JSON response
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      const answer = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.delta?.content;
      if (typeof answer === "string") return answer.trim();
    } catch {
      // fall through to SSE stream parsing
    }
  }

  // 2. Try Server-Sent Events (SSE) stream format (data: {...})
  if (trimmed.includes("data:")) {
    let accumulated = "";
    const lines = trimmed.split("\n");
    for (const line of lines) {
      const l = line.trim();
      if (!l.startsWith("data:")) continue;
      const payload = l.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const chunk =
          json.choices?.[0]?.delta?.content ??
          json.choices?.[0]?.message?.content ??
          json.response ??
          "";
        if (typeof chunk === "string") {
          accumulated += chunk;
        }
      } catch {
        // ignore unparseable chunk
      }
    }
    if (accumulated.trim()) {
      return accumulated.trim();
    }
  }

  // 3. Fallback: plain text response
  return trimmed;
}

export async function askAssistant(
  prompt: string,
  config: AssistantConfig,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new Error("API key is not configured. Set your credentials in Settings > Advanced.");
  }

  const endpoint = resolveChatUrl(config.baseUrl || "https://api.openai.com/v1");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const body = {
    model: config.model.trim() || "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt.trim() },
    ],
    stream: false,
    temperature: 0.5,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  const rawText = await res.text();

  if (!res.ok) {
    let errDetail = "";
    try {
      const errJson = JSON.parse(rawText);
      errDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      errDetail = rawText;
    }
    throw new Error(`API error (${res.status}): ${errDetail || res.statusText}`);
  }

  return parseResponseBody(rawText);
}
