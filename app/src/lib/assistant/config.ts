export interface AssistantConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "",
};

export const ASSISTANT_CONFIG_KEY = "lattice:assistant_config";
export const ASSISTANT_EVENT = "assistant:config_changed";

export function getAssistantConfig(): AssistantConfig {
  try {
    const raw = localStorage.getItem(ASSISTANT_CONFIG_KEY);
    if (!raw) return DEFAULT_ASSISTANT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : DEFAULT_ASSISTANT_CONFIG.baseUrl,
      model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : DEFAULT_ASSISTANT_CONFIG.model,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "",
    };
  } catch {
    return DEFAULT_ASSISTANT_CONFIG;
  }
}

export function saveAssistantConfig(cfg: AssistantConfig): void {
  try {
    localStorage.setItem(ASSISTANT_CONFIG_KEY, JSON.stringify(cfg));
  } catch { /* ignore */ }
}
