export interface ToolParamProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolParamProperty>;
      required?: string[];
    };
  };
}

export interface Skill {
  name: string;
  title: string;
  description: string;
  instructions: string;
  tools: ToolDefinition[];
  execute: (toolName: string, args: any) => Promise<any> | any;
}
