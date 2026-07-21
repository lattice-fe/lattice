// Dev-stub identity, same convention as the backend's get_current_principal:
// a header standing in for a real identity provider. Fine for a single-user
// dev setup; the seam is on the backend, not here.
export const PRINCIPAL_ID = "lattice-local";

export type Scope = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count: number;
};

export type DocumentStatus =
  | "pending"
  | "parsing"
  | "parsed"
  | "chunking"
  | "chunked"
  | "embedding"
  | "embedded"
  | "summarizing"
  | "ready"
  | "failed"
  | "unsupported";

export type DocumentCategory = "spec" | "research" | "decision" | "incident" | "notes" | "data";

export type Document = {
  id: string;
  scope_id: string;
  external_ref: string;
  mime_type: string | null;
  file_extension: string | null;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
  title: string | null;
  one_liner: string | null;
  category: DocumentCategory | null;
};

export type DocumentDetail = Document & {
  summary_text: string | null;
  structured_data: { sheet_names?: string[]; tables?: TableSchema[] } | null;
};

export type TableSchema = {
  table_name: string;
  row_count: number;
  columns: { name: string; dtype: string; null_rate: number; sample_values: unknown[] }[];
};

export type Chunk = {
  chunk_index: number;
  content: string;
  structural_metadata: { heading_path?: string[]; page?: number; slide?: number };
};

export type PointerIndex = {
  rollup_text: string;
  doc_count: number;
  last_consolidated_at: string | null;
};

export type ChatSource = {
  document_id: string;
  external_ref: string;
  heading_path: string[];
};

export type ChatSession = {
  id: string;
  scope_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[] | null;
  created_at: string;
};

export type ChatSessionDetail = ChatSession & {
  messages: ChatMessage[];
};

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "X-Principal-External-Id": PRINCIPAL_ID,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, `${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function json(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export const api = {
  listScopes: () => request<Scope[]>("/scopes"),
  createScope: (name: string, description?: string) => request<Scope>("/scopes", json({ name, description })),
  getScope: (scopeId: string) => request<Scope>(`/scopes/${scopeId}`),

  listDocuments: (scopeId: string) => request<Document[]>(`/scopes/${scopeId}/documents`),
  getDocument: (scopeId: string, documentId: string) =>
    request<DocumentDetail>(`/scopes/${scopeId}/documents/${documentId}`),
  getDocumentChunks: (scopeId: string, documentId: string) =>
    request<Chunk[]>(`/scopes/${scopeId}/documents/${documentId}/chunks`),
  uploadDocument: (scopeId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Document>(`/scopes/${scopeId}/documents`, { method: "POST", body: form });
  },

  getPointerIndex: (scopeId: string) => request<PointerIndex>(`/scopes/${scopeId}/pointer-index`),
  forceConsolidate: (scopeId: string) =>
    request<{ job_id: string }>(`/scopes/${scopeId}/admin/consolidate`, { method: "POST" }),

  listSessions: (scopeId: string) => request<ChatSession[]>(`/scopes/${scopeId}/chat/sessions`),
  createSession: (scopeId: string, title?: string) =>
    request<ChatSession>(`/scopes/${scopeId}/chat/sessions`, json({ title })),
  getSession: (scopeId: string, sessionId: string) =>
    request<ChatSessionDetail>(`/scopes/${scopeId}/chat/sessions/${sessionId}`),
  deleteSession: (scopeId: string, sessionId: string) =>
    request<void>(`/scopes/${scopeId}/chat/sessions/${sessionId}`, { method: "DELETE" }),
  sendMessage: (scopeId: string, sessionId: string, question: string) =>
    request<ChatMessage>(`/scopes/${scopeId}/chat/sessions/${sessionId}/messages`, json({ question })),
};

export { ApiError };
