from dataclasses import dataclass, field

from app.parsers.base import ParsedSection

TOKEN_TARGET = 400
TOKEN_MAX = 600


@dataclass
class ChunkedPiece:
    text: str
    token_count: int
    structural_metadata: dict = field(default_factory=dict)


def _count_tokens(text: str) -> int:
    try:
        import tiktoken

        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception:
        return max(1, len(text) // 4)  # rough fallback if tiktoken/encoding unavailable


def _structural_metadata(section: ParsedSection) -> dict:
    meta = {"heading_path": section.heading_path, **section.metadata}
    if section.page_number is not None:
        meta["page"] = section.page_number
    if section.slide_number is not None:
        meta["slide"] = section.slide_number
    return meta


def _split_long_section(section: ParsedSection) -> list[ChunkedPiece]:
    """Section exceeds TOKEN_MAX on its own: split on paragraph boundaries,
    greedily packing paragraphs up to TOKEN_TARGET per piece."""
    paragraphs = [p for p in section.text.split("\n\n") if p.strip()]
    meta = _structural_metadata(section)
    pieces: list[ChunkedPiece] = []
    buffer: list[str] = []
    buffer_tokens = 0

    def flush() -> None:
        if buffer:
            pieces.append(ChunkedPiece(text="\n\n".join(buffer), token_count=buffer_tokens, structural_metadata=meta))

    for para in paragraphs:
        para_tokens = _count_tokens(para)
        if buffer and buffer_tokens + para_tokens > TOKEN_TARGET:
            flush()
            buffer, buffer_tokens = [], 0
        buffer.append(para)
        buffer_tokens += para_tokens
    flush()

    if not pieces:  # single giant paragraph with no blank-line breaks
        pieces = [ChunkedPiece(text=section.text, token_count=_count_tokens(section.text), structural_metadata=meta)]
    return pieces


def chunk_sections(sections: list[ParsedSection]) -> list[ChunkedPiece]:
    """Token-bounded chunking, independent of file type. Splits sections that
    are too long, merges adjacent short sections that share a heading_path so
    small slides/paragraphs don't each become their own near-empty chunk."""
    pieces: list[ChunkedPiece] = []
    buffer_sections: list[ParsedSection] = []
    buffer_tokens = 0

    def flush() -> None:
        if not buffer_sections:
            return
        text = "\n\n".join(s.text for s in buffer_sections)
        meta = _structural_metadata(buffer_sections[0])
        pieces.append(ChunkedPiece(text=text, token_count=buffer_tokens, structural_metadata=meta))

    for section in sections:
        tokens = _count_tokens(section.text)

        if tokens > TOKEN_MAX:
            flush()
            buffer_sections, buffer_tokens = [], 0
            pieces.extend(_split_long_section(section))
            continue

        same_heading = buffer_sections and buffer_sections[-1].heading_path == section.heading_path
        if buffer_sections and (not same_heading or buffer_tokens + tokens > TOKEN_TARGET):
            flush()
            buffer_sections, buffer_tokens = [], 0

        buffer_sections.append(section)
        buffer_tokens += tokens

    flush()
    return pieces
