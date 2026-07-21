import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Document } from "./api";

const TERMINAL_STATUSES = new Set<Document["status"]>(["ready", "failed", "unsupported"]);

export function useScopes() {
  return useQuery({ queryKey: ["scopes"], queryFn: api.listScopes });
}

export function useCreateScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      api.createScope(name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scopes"] }),
  });
}

export function useDocuments(scopeId: string | null) {
  return useQuery({
    queryKey: ["documents", scopeId],
    queryFn: () => api.listDocuments(scopeId as string),
    enabled: !!scopeId,
    // Poll while anything is still being processed; stop once everything
    // lands in a terminal state so we're not hammering the API forever.
    refetchInterval: (query) => {
      const docs = query.state.data as Document[] | undefined;
      if (!docs) return 2000;
      const stillWorking = docs.some((d) => !TERMINAL_STATUSES.has(d.status));
      return stillWorking ? 2000 : false;
    },
  });
}

export function useDocument(scopeId: string | null, documentId: string | null) {
  return useQuery({
    queryKey: ["document", scopeId, documentId],
    queryFn: () => api.getDocument(scopeId as string, documentId as string),
    enabled: !!scopeId && !!documentId,
  });
}

export function useDocumentChunks(scopeId: string | null, documentId: string | null) {
  return useQuery({
    queryKey: ["document-chunks", scopeId, documentId],
    queryFn: () => api.getDocumentChunks(scopeId as string, documentId as string),
    enabled: !!scopeId && !!documentId,
  });
}

export function usePointerIndex(scopeId: string | null) {
  return useQuery({
    queryKey: ["pointer-index", scopeId],
    queryFn: () => api.getPointerIndex(scopeId as string),
    enabled: !!scopeId,
  });
}

export function useUploadDocument(scopeId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadDocument(scopeId as string, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", scopeId] }),
  });
}

export function useSessions(scopeId: string | null) {
  return useQuery({
    queryKey: ["chat-sessions", scopeId],
    queryFn: () => api.listSessions(scopeId as string),
    enabled: !!scopeId,
  });
}

export function useSession(scopeId: string | null, sessionId: string | null) {
  return useQuery({
    queryKey: ["chat-session", scopeId, sessionId],
    queryFn: () => api.getSession(scopeId as string, sessionId as string),
    enabled: !!scopeId && !!sessionId,
  });
}

export function useCreateSession(scopeId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => api.createSession(scopeId as string, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-sessions", scopeId] }),
  });
}

export function useDeleteSession(scopeId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.deleteSession(scopeId as string, sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-sessions", scopeId] }),
  });
}

export function useSendMessage(scopeId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    // sessionId travels with the mutation (not a closure) so a message sent
    // immediately after creating a session targets the right one — otherwise
    // the first message of a brand-new conversation posts to a stale null id.
    mutationFn: ({ sessionId, question }: { sessionId: string; question: string }) =>
      api.sendMessage(scopeId as string, sessionId, question),
    onSuccess: (_data, { sessionId }) => {
      qc.invalidateQueries({ queryKey: ["chat-session", scopeId, sessionId] });
      qc.invalidateQueries({ queryKey: ["chat-sessions", scopeId] });
    },
  });
}
