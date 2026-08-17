import { streamText, stepCountIs, tool, jsonSchema, type ModelMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { AssistantConfig } from "./config";
import {
  getAllAssistantTools,
  executeAssistantTool,
  getSkillsCatalogPrompt,
} from "./skills";

export const SYSTEM_PROMPT = `
You are Watson, a refined and concise British desktop assistant inside Lattice file manager.
Provide direct, accurate, and short answers with subtle British charm and wit, without filler, meta-commentary, or rambling preambles.
For code or commands, provide just the snippet or command.

${getSkillsCatalogPrompt()}

## Using tools
Act immediately — do not deliberate about which tool or where something might be. Call the matching tool once with your best arguments, then answer from the result.
- To find ANY file or folder, call 'search_files' a single time with the user's keywords. It searches the ENTIRE index at once — it is NOT scoped to a folder. Never use 'list_directory' to hunt for a file, and never guess or reason about where a file might live.
- Use 'list_directory' only when the user explicitly asks what is inside a specific folder they named.
- All tools are already available to you. Do NOT call 'read_skill' unless a tool errors or its behaviour is genuinely unclear — you almost never need it.
- Prefer a single tool call. Only make another call if the first returned nothing useful. Do not chain redundant searches.
`.trim();

export type { ModelMessage };

export interface ToolStep {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  detail?: string; // primary argument (path / query / title) for a richer label
}

// The one argument worth showing in the step trace, per tool.
function stepDetail(input: unknown): string | undefined {
  const a = input as Record<string, unknown> | undefined;
  const v = a?.path ?? a?.query ?? a?.title ?? a?.name ?? a?.skill_name;
  return typeof v === "string" && v.trim() ? v : undefined;
}

export interface StreamCallbacks {
  systemContext?: string;
  signal?: AbortSignal;
  onText?: (delta: string) => void;
  onReasoning?: (delta: string) => void;
  onStep?: (step: ToolStep) => void;
}

// Base URL the OpenAI-compatible provider appends /chat/completions to.
export function resolveBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  if (!/\/v\d+$/.test(url) && !url.includes("/v1/")) url += "/v1";
  return url;
}

function makeModel(config: AssistantConfig) {
  const apiKey = config.apiKey.trim();
  if (!apiKey) {
    throw new Error("API key is not configured. Set your credentials in Settings > Advanced.");
  }
  const provider = createOpenAICompatible({
    name: "watson",
    baseURL: resolveBaseUrl(config.baseUrl || "https://api.openai.com/v1"),
    apiKey,
  });
  return provider(config.model.trim() || "gpt-4o-mini");
}

// Adapt the existing skill tool defs (OpenAI function JSON-schema shape) to the
// AI SDK's tool() format — reusing the same schema and executor dispatch.
function buildTools() {
  const tools: Record<string, any> = {};
  for (const d of getAllAssistantTools()) {
    tools[d.function.name] = tool({
      description: d.function.description,
      inputSchema: jsonSchema(d.function.parameters as any),
      execute: async (args: any) => {
        const r = await executeAssistantTool(d.function.name, args);
        return typeof r === "string" ? r : JSON.stringify(r);
      },
    });
  }
  return tools;
}

function systemFor(context?: string) {
  return context ? `${SYSTEM_PROMPT}\n\n## Current Workspace Context\n${context}` : SYSTEM_PROMPT;
}

// Some OpenAI-compatible endpoints accept `reasoning_content` in responses but
// reject it as input on the next step/turn. Drop reasoning parts from assistant
// messages before they're re-sent (and before we persist them).
function stripReasoning(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((m) => {
    if (m.role !== "assistant" || !Array.isArray(m.content)) return m;
    return { ...m, content: (m.content as any[]).filter((p) => p.type !== "reasoning") } as ModelMessage;
  });
}

/**
 * Streaming, multi-step agent turn. Streams text/reasoning deltas and tool
 * steps through callbacks; returns the new model messages (assistant + tool)
 * to append to the conversation so tool context survives across turns.
 */
export async function streamAssistant(
  history: ModelMessage[],
  config: AssistantConfig,
  cb: StreamCallbacks = {}
): Promise<{ messages: ModelMessage[] }> {
  let appended: ModelMessage[] = [];

  const result = streamText({
    model: makeModel(config),
    system: systemFor(cb.systemContext),
    messages: stripReasoning(history), // never send prior reasoning back
    tools: buildTools(),
    stopWhen: stepCountIs(6),
    abortSignal: cb.signal,
    temperature: 0.5,
    prepareStep: ({ messages }) => ({ messages: stripReasoning(messages) }),
    onFinish: (e) => { appended = stripReasoning(e.responseMessages as ModelMessage[]); },
  });

  const detailById = new Map<string, string | undefined>();
  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta": cb.onText?.(part.text); break;
      case "reasoning-delta": cb.onReasoning?.(part.text); break;
      case "tool-call": {
        const detail = stepDetail((part as { input?: unknown }).input);
        detailById.set(part.toolCallId, detail);
        cb.onStep?.({ id: part.toolCallId, name: part.toolName, status: "running", detail });
        break;
      }
      case "tool-result": cb.onStep?.({ id: part.toolCallId, name: part.toolName, status: "done", detail: detailById.get(part.toolCallId) }); break;
      case "tool-error": cb.onStep?.({ id: part.toolCallId, name: part.toolName, status: "error", detail: detailById.get(part.toolCallId) }); break;
      case "error": throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }

  return { messages: appended };
}

// One-shot (Spotlight, connection test, action modal). Runs through the
// streaming path and collects the final text — many OpenAI-compatible proxies
// (e.g. Omniroute) always reply with an SSE stream even for a non-stream
// request, which a plain generateText() can't parse ("Invalid JSON response").
export async function askAssistant(
  prompt: string,
  config: AssistantConfig,
  signal?: AbortSignal
): Promise<string> {
  let text = "";
  await streamAssistant([{ role: "user", content: prompt.trim() }], config, {
    signal,
    onText: (d) => { text += d; },
  });
  return text.trim() || "Done.";
}
