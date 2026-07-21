import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.documents import Document
from app.models.principals import Principal
from app.permissions.checks import PermissionDenied, require_scope_access
from app.permissions.dependencies import get_current_principal
from app.providers.factory import get_chat_provider, get_embedding_provider
from app.repositories import chat_repo, chunk_repo, scope_repo, summary_repo
from app.schemas.chat import AskRequest, ChatSource, MessageOut, SessionCreate, SessionDetailOut, SessionOut

router = APIRouter(prefix="/scopes/{scope_id}/chat", tags=["chat"])

_PROMPT = """You are answering questions about documents in a workspace called "{scope_name}".

Overview of what this workspace contains:
{pointer_rollup}
{history_block}
Most relevant excerpts for this question:
{excerpts}

Question: {question}

Answer using only the excerpts above. If they don't contain the answer, say so plainly. Keep it concise.
"""

_HISTORY_TURNS = 3  # last N user/assistant pairs included for conversational continuity


def _answer_question(
    db: Session, scope_id: uuid.UUID, scope_name: str, question: str, history: list[ChatMessage]
) -> tuple[str, list[ChatSource]]:
    settings = get_settings()
    embedding_provider = get_embedding_provider()
    embedding_model = chunk_repo.get_or_create_embedding_model(
        db, settings.embedding_provider, settings.embedding_model, embedding_provider.dimension
    )
    query_vector = embedding_provider.embed([question])[0]
    hits = chunk_repo.search_similar_chunks(db, scope_id, embedding_model.id, query_vector, limit=8)

    pointer = summary_repo.get_pointer_index(db, scope_id)
    pointer_rollup = pointer.rollup_text if pointer and pointer.rollup_text else "(no overview yet)"

    if not hits:
        return "This workspace has no ingested content yet to answer from.", []

    excerpt_lines = []
    sources: list[ChatSource] = []
    seen_docs: dict[uuid.UUID, Document] = {}
    for i, (chunk, _distance) in enumerate(hits, start=1):
        document = seen_docs.get(chunk.document_id)
        if document is None:
            document = db.get(Document, chunk.document_id)
            seen_docs[chunk.document_id] = document
        heading_path = chunk.structural_metadata.get("heading_path", [])
        excerpt_lines.append(f"[{i}] (from {document.external_ref} — {' > '.join(heading_path)}):\n{chunk.content}")
        sources.append(ChatSource(document_id=document.id, external_ref=document.external_ref, heading_path=heading_path))

    history_block = ""
    if history:
        turns = "\n".join(f"{m.role.capitalize()}: {m.content}" for m in history[-_HISTORY_TURNS * 2 :])
        history_block = f"\nRecent conversation so far:\n{turns}\n"

    prompt = _PROMPT.format(
        scope_name=scope_name,
        pointer_rollup=pointer_rollup,
        history_block=history_block,
        excerpts="\n\n".join(excerpt_lines),
        question=question,
    )

    answer = get_chat_provider().complete([{"role": "user", "content": prompt}], max_tokens=600)
    return answer, sources


@router.post("/sessions", response_model=SessionOut)
def create_session(
    scope_id: uuid.UUID,
    body: SessionCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> SessionOut:
    try:
        session = chat_repo.create_session(db, principal.id, scope_id, body.title)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    db.commit()
    return SessionOut.model_validate(session)


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    scope_id: uuid.UUID, db: Session = Depends(get_db), principal: Principal = Depends(get_current_principal)
) -> list[SessionOut]:
    try:
        sessions = chat_repo.list_sessions(db, principal.id, scope_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return [SessionOut.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
def get_session(
    scope_id: uuid.UUID,
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> SessionDetailOut:
    try:
        session = chat_repo.get_session(db, principal.id, scope_id, session_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    messages = chat_repo.list_messages(db, session_id)
    return SessionDetailOut(**SessionOut.model_validate(session).model_dump(), messages=[MessageOut.model_validate(m) for m in messages])


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(
    scope_id: uuid.UUID,
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> None:
    try:
        chat_repo.delete_session(db, principal.id, scope_id, session_id)
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()


@router.post("/sessions/{session_id}/messages", response_model=MessageOut)
def ask(
    scope_id: uuid.UUID,
    session_id: uuid.UUID,
    body: AskRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
) -> MessageOut:
    try:
        session: ChatSession = chat_repo.get_session(db, principal.id, scope_id, session_id)
        scope = scope_repo.get_scope(db, principal.id, scope_id)
        require_scope_access(db, principal.id, scope_id, "read")
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    history = chat_repo.list_messages(db, session_id)
    chat_repo.add_message(db, session, "user", body.question)

    answer, sources = _answer_question(db, scope_id, scope.name, body.question, history)

    assistant_message = chat_repo.add_message(
        db, session, "assistant", answer, sources=[s.model_dump(mode="json") for s in sources]
    )
    db.commit()
    return MessageOut.model_validate(assistant_message)
