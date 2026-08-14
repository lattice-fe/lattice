import { Skill } from "./types";
import { api, searchOnce, SearchMode } from "../../api";
import { baseName } from "../../format";
import { kindOf } from "../../icons";

const instructions = `
# Skill: File Search & Workspace Navigation (Lattice Index)

Use this skill to locate files, search inside document contents, explore folder structures, and retrieve document snippets for the user.

## Capabilities
- **Name Search ('name')**: Fast fuzzy matching on file names and directory names.
- **Full-text Search ('text')**: Search inside indexed text files, code, and markdown documents for exact or wildcard terms.
- **Semantic Search ('semantic')**: Natural language concept matching across indexed collections.
- **Directory Listing**: Inspect folder contents when the user asks what is inside a path.
- **File Preview**: Read the text content of a file to summarize or answer questions about it.

## Best Practices
- When asked to find or locate files, run 'search_files' with the query and optional directory context.
- When asked to summarize or explain a file, call 'read_file_preview' on its absolute path.
- Provide clean clickable markdown links when referencing paths, e.g. '[filename](file:///path/to/file)'.
`.trim();

export const searchSkill: Skill = {
  name: "search",
  title: "File Search & Workspace Navigation",
  description: "Search indexed files, query document contents, list directory contents, and read file previews.",
  instructions,
  tools: [
    {
      type: "function",
      function: {
        name: "search_files",
        description: "Search indexed files by name, full-text content, or semantic meaning",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query or keywords" },
            directory: { type: "string", description: "Optional folder path to search inside" },
            mode: {
              type: "string",
              enum: ["name", "text", "semantic"],
              description: "Search mode: 'name' (filename fuzzy), 'text' (content), or 'semantic' (concept)",
            },
            limit: { type: "number", description: "Maximum number of results to return (default: 8)" },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_directory",
        description: "List files and subdirectories inside a specific folder path",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute folder path (or '~' for home)" },
            show_hidden: { type: "boolean", description: "Whether to include hidden files" },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file_preview",
        description: "Read the text content of a file for analysis or summary",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute path of the file to read" },
            max_length: { type: "number", description: "Max characters to read (default: 6000)" },
          },
          required: ["path"],
        },
      },
    },
  ],
  async execute(name: string, args: any) {
    switch (name) {
      case "search_files": {
        const query = (args.query || "").trim();
        const limit = args.limit || 8;
        if (!query) return { query, found: false, message: "Empty query." };

        // Query the Lattice index (same source as the `lat` CLI). Start in the
        // requested mode, then fall back across modes so a name query still
        // finds content matches and vice-versa.
        const requested: SearchMode = args.mode === "text" || args.mode === "semantic" ? args.mode : "name";
        const order: SearchMode[] = [requested, ...(["name", "text", "semantic"] as SearchMode[]).filter((m) => m !== requested)];

        let hits: Awaited<ReturnType<typeof searchOnce>> = [];
        for (const mode of order) {
          hits = await searchOnce(query, mode);
          if (hits.length > 0) break;
        }

        if (args.directory) {
          const d = String(args.directory).replace(/\\/g, "/").toLowerCase();
          hits = hits.filter((h) => h.file_path.replace(/\\/g, "/").toLowerCase().startsWith(d));
        }

        if (hits.length === 0) {
          return { query, found: false, message: `No indexed files found matching "${query}". The folder may not be indexed yet.` };
        }
        return hits.slice(0, limit).map((h) => ({
          name: baseName(h.file_path),
          path: h.file_path,
          is_dir: h.is_dir,
          snippet: h.snippet,
          kind: h.is_dir ? "folder" : kindOf(h.file_path),
        }));
      }
      case "list_directory": {
        try {
          const path = args.path === "~" ? await api.homeDir() : args.path;
          const entries = await api.listDir(path, Boolean(args.show_hidden));
          return entries.slice(0, 30).map((e) => ({
            name: e.name,
            path: e.path,
            is_dir: e.is_dir,
            kind: e.kind || (e.is_dir ? "folder" : kindOf(e.name)),
            size: e.size,
          }));
        } catch (err: any) {
          return { error: err.message || `Failed to list directory: ${args.path}` };
        }
      }
      case "read_file_preview": {
        try {
          const text = await api.readFile(args.path);
          const max = args.max_length || 6000;
          const truncated = text.length > max ? text.slice(0, max) + "\n\n[...truncated]" : text;
          return { path: args.path, content: truncated, length: text.length };
        } catch (err: any) {
          return { error: err.message || `Failed to read file: ${args.path}` };
        }
      }
      default:
        return { error: `Unknown search tool: ${name}` };
    }
  },
};
