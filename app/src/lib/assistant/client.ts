import { AssistantConfig } from "./config";
import { getNotes, createNote, searchNotes } from "../keep/store";

export const SYSTEM_PROMPT =
  "You are Watson, a refined and concise British desktop assistant inside Lattice file manager. Provide direct, accurate, and short answers with subtle British charm and wit, without filler, meta-commentary, or rambling preambles. For code or commands, provide just the snippet or command. You can manage the user's notes and checklists in Lattice Keep using tools.";

export const KEEP_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a new note or checklist in Lattice Keep",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the note or checklist" },
          content: { type: "string", description: "Markdown body text for regular notes" },
          items: {
            type: "array",
            items: { type: "string" },
            description: "List of items if creating a checklist/to-do list",
          },
          type: {
            type: "string",
            enum: ["note", "checklist"],
            description: "Type of note to create",
          },
          color: {
            type: "string",
            enum: ["default", "amber", "terracotta", "sage", "slate", "violet", "rose", "sand"],
            description: "Color tint for the note card",
          },
          pinned: { type: "boolean", description: "Whether to pin the note to the top" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_notes",
      description: "Search user's notes and checklists in Lattice Keep",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keywords or topic to search for" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "List recent notes and checklists from Lattice Keep",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of notes to return (default: 6)" },
        },
      },
    },
  },
];

function executeKeepTool(name: string, args: any): any {
  try {
    if (name === "create_note") {
      const note = createNote({
        title: args.title,
        content: args.content,
        items: args.items,
        type: args.type || (args.items && args.items.length > 0 ? "checklist" : "note"),
        color: args.color || "amber",
        pinned: args.pinned,
        author: "watson",
      });
      return { success: true, note_id: note.id, title: note.title, type: note.type };
    }
    if (name === "search_notes") {
      const results = searchNotes(args.query || "");
      return results.slice(0, 5).map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        items: n.items?.map((it) => it.text),
        pinned: n.pinned,
      }));
    }
    if (name === "list_notes") {
      const notes = getNotes().slice(0, args.limit || 6);
      return notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        items: n.items?.map((it) => it.text),
        pinned: n.pinned,
      }));
    }
  } catch (err: any) {
    return { error: err.message || "Failed to execute tool" };
  }
  return { error: `Unknown tool: ${name}` };
}

export function resolveChatUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (url.endsWith("/chat/completions")) return url;
  if (!url.endsWith("/v1") && !url.includes("/v1/")) {
    url += "/v1";
  }
  return `${url}/chat/completions`;
}

export function parseResponseBody(rawText: string): { content: string; toolCalls?: any[] } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Received an empty response from the assistant API.");
  }

  // 1. Try standard JSON response
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed);
      const message = data.choices?.[0]?.message;
      if (message?.tool_calls && message.tool_calls.length > 0) {
        return { content: message.content || "", toolCalls: message.tool_calls };
      }
      const answer = message?.content ?? data.choices?.[0]?.delta?.content;
      if (typeof answer === "string") return { content: answer.trim() };
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
      return { content: accumulated.trim() };
    }
  }

  // 3. Fallback: plain text response
  return { content: trimmed };
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

  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt.trim() },
  ];

  const body: any = {
    model: config.model.trim() || "gpt-4o-mini",
    messages,
    tools: KEEP_TOOLS,
    stream: false,
    temperature: 0.5,
  };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: any) {
    // If endpoint doesn't support tools parameter, retry without tools
    body.tools = undefined;
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  }

  const rawText = await res.text();

  if (!res.ok) {
    // If rejected due to unsupported tools schema, retry cleanly without tools
    if (body.tools && (res.status === 400 || res.status === 422)) {
      body.tools = undefined;
      const retryRes = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      });
      const retryText = await retryRes.text();
      if (retryRes.ok) {
        return parseResponseBody(retryText).content;
      }
    }

    let errDetail = "";
    try {
      const errJson = JSON.parse(rawText);
      errDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
    } catch {
      errDetail = rawText;
    }
    throw new Error(`API error (${res.status}): ${errDetail || res.statusText}`);
  }

  const parsed = parseResponseBody(rawText);

  // If tool calls were returned, execute them and make the follow-up completion
  if (parsed.toolCalls && parsed.toolCalls.length > 0) {
    messages.push({
      role: "assistant",
      content: parsed.content || null,
      tool_calls: parsed.toolCalls,
    });

    for (const tc of parsed.toolCalls) {
      let args = {};
      try {
        args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      } catch {
        args = {};
      }
      const result = executeKeepTool(tc.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result),
      });
    }

    // Follow-up request to get Watson's final answer
    const followUpBody = {
      model: config.model.trim() || "gpt-4o-mini",
      messages,
      stream: false,
      temperature: 0.5,
    };

    const followUpRes = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(followUpBody),
      signal,
    });

    if (followUpRes.ok) {
      const followUpText = await followUpRes.text();
      return parseResponseBody(followUpText).content;
    }
  }

  return parsed.content;
}
