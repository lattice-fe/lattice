import { streamText, generateText, stepCountIs, tool, jsonSchema, type ModelMessage } from "ai";
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

When assisting the user with tasks related to any skill domain, you may execute the appropriate tools directly or call 'read_skill' to review comprehensive instructions and capabilities.
`.trim();

export type { ModelMessage };

export interface ToolStep {
  id: string;
  name: string;
  status: "running" | "done" | "error";
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
    messages: history,
    tools: buildTools(),
    stopWhen: stepCountIs(8),
    abortSignal: cb.signal,
    temperature: 0.5,
    onFinish: (e) => { appended = e.responseMessages as ModelMessage[]; },
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta": cb.onText?.(part.text); break;
      case "reasoning-delta": cb.onReasoning?.(part.text); break;
      case "tool-call": cb.onStep?.({ id: part.toolCallId, name: part.toolName, status: "running" }); break;
      case "tool-result": cb.onStep?.({ id: part.toolCallId, name: part.toolName, status: "done" }); break;
      case "tool-error": cb.onStep?.({ id: part.toolCallId, name: part.toolName, status: "error" }); break;
      case "error": throw part.error instanceof Error ? part.error : new Error(String(part.error));
    }
  }

  return { messages: appended };
}

// Non-streaming one-shot (Spotlight, connection test, action modal).
export async function askAssistant(
  prompt: string,
  config: AssistantConfig,
  signal?: AbortSignal
): Promise<string> {
  const { text } = await generateText({
    model: makeModel(config),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt.trim() }],
    tools: buildTools(),
    stopWhen: stepCountIs(8),
    abortSignal: signal,
    temperature: 0.5,
  });
  return text.trim() || "Done.";
}
