import re
from pathlib import Path

from app.parsers.base import ParsedDocument, ParsedSection, Parser

_EXTENSIONS = {".md", ".markdown", ".txt"}
_MIME_TYPES = {"text/markdown", "text/plain"}

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


class TextParser(Parser):
    """Markdown is split on heading tokens, building a heading_path stack.
    Plain .txt has no structure to key off, so it falls back to paragraph
    chunking with a no_structure metadata flag."""

    name = "text"
    version = "1"

    @staticmethod
    def supports(mime_type: str | None, extension: str) -> bool:
        return extension.lower() in _EXTENSIONS or mime_type in _MIME_TYPES

    def parse(self, file_path: Path) -> ParsedDocument:
        content = file_path.read_text(encoding="utf-8", errors="replace")
        if file_path.suffix.lower() == ".txt":
            return ParsedDocument(kind="text", sections=_paragraph_sections(file_path, content))
        return ParsedDocument(kind="text", sections=_markdown_sections(file_path, content))


def _paragraph_sections(file_path: Path, content: str) -> list[ParsedSection]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]
    if not paragraphs:
        return []
    text = "\n\n".join(paragraphs)
    return [ParsedSection(heading_path=[file_path.stem], text=text, metadata={"no_structure": True})]


def _markdown_sections(file_path: Path, content: str) -> list[ParsedSection]:
    sections: list[ParsedSection] = []
    headings: list[str] = []  # headings[i] = title of level-(i+1) heading currently in scope
    buffer: list[str] = []

    def flush() -> None:
        text = "\n".join(buffer).strip()
        if text:
            sections.append(ParsedSection(heading_path=[file_path.stem, *headings], text=text))
        buffer.clear()

    for line in content.splitlines():
        match = _HEADING_RE.match(line)
        if match:
            flush()
            level, title = len(match.group(1)), match.group(2).strip()
            headings = headings[: level - 1] + [title]
            continue
        buffer.append(line)
    flush()

    if not sections:
        text = content.strip()
        if text:
            sections.append(ParsedSection(heading_path=[file_path.stem], text=text, metadata={"no_structure": True}))
    return sections
