// "full": Watson chat pane + context-menu actions + Spotlight queries.
// "spotlight": only Spotlight "!" queries. "off": no AI features at all.
export type AiMode = "full" | "spotlight" | "off";

export interface AssistantConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  aiMode: AiMode;
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "",
  aiMode: "full",
};

export const ASSISTANT_CONFIG_KEY = "lattice:assistant_config";
export const ASSISTANT_EVENT = "assistant:config_changed";     // Tauri, cross-window
export const ASSISTANT_DOM_EVENT = "lattice:assistant-config"; // same-window (main)

export function getAssistantConfig(): AssistantConfig {
  try {
    const raw = localStorage.getItem(ASSISTANT_CONFIG_KEY);
    if (!raw) return DEFAULT_ASSISTANT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : DEFAULT_ASSISTANT_CONFIG.baseUrl,
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : DEFAULT_ASSISTANT_CONFIG.model,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "",
      aiMode: parsed.aiMode === "spotlight" || parsed.aiMode === "off" ? parsed.aiMode : "full",
    };
  } catch {
    return DEFAULT_ASSISTANT_CONFIG;
  }
}

export function saveAssistantConfig(cfg: AssistantConfig): void {
  try {
    localStorage.setItem(ASSISTANT_CONFIG_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new CustomEvent(ASSISTANT_DOM_EVENT));
  } catch { /* ignore */ }
}
