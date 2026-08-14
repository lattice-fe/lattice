import { Skill, ToolDefinition } from "./types";
import { notesSkill } from "./notes";
import { searchSkill } from "./search";

export const SKILLS: Skill[] = [notesSkill, searchSkill];

export const READ_SKILL_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "read_skill",
    description: "Read the detailed instructions, guidelines, and capabilities for a specific assistant skill",
    parameters: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          enum: SKILLS.map((s) => s.name),
          description: "The name of the skill to read instructions for",
        },
      },
      required: ["skill_name"],
    },
  },
};

export function getSkillsCatalogPrompt(): string {
  const list = SKILLS.map((s) => `- **${s.name}** (${s.title}): ${s.description}`).join("\n");
  return `
## Available Skills
Their tools are already loaded and callable directly — you do not need to read a skill first.

${list}
`.trim();
}

export function getAllAssistantTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [READ_SKILL_TOOL];
  for (const s of SKILLS) {
    tools.push(...s.tools);
  }
  return tools;
}

export async function executeAssistantTool(name: string, args: any): Promise<any> {
  if (name === "read_skill") {
    const skillName = args.skill_name || args.name;
    const skill = SKILLS.find((s) => s.name === skillName);
    if (!skill) {
      return {
        error: `Skill '${skillName}' not found. Available skills: ${SKILLS.map((s) => s.name).join(", ")}`,
      };
    }
    return {
      skill: skill.name,
      title: skill.title,
      description: skill.description,
      instructions: skill.instructions,
      tools: skill.tools.map((t) => t.function.name),
    };
  }

  for (const s of SKILLS) {
    if (s.tools.some((t) => t.function.name === name)) {
      return await s.execute(name, args);
    }
  }

  return { error: `Unknown tool '${name}'` };
}

export * from "./types";
export * from "./notes";
export * from "./search";
