from pathlib import Path

from app.parsers.base import ParsedDocument, ParsedSection, Parser

_EXTENSIONS = {".pdf", ".docx"}
_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class PdfDocxParser(Parser):
    """Layout/heading-aware extraction via `unstructured`, one code path for
    both formats rather than hand-rolled font-size heuristics. Sections are
    grouped by the most recent Title element; a doc with no detected titles
    falls back to one section per page (PDF) or a single section (DOCX).

    Deliberately calls the format-specific partition_docx/partition_pdf
    functions rather than unstructured.partition.auto.partition(). auto's
    dispatcher imports every registered format's partitioner (OCR, email,
    HTML, ...) just to route a single file, which in practice pulled in the
    full unstructured-inference/torch/onnxruntime stack even for a plain
    DOCX — turning a trivial extraction into a multi-minute, all-cores
    import. We already know the extension from the registry, so there's
    nothing for auto-detection to add here.

    strategy="fast" for PDFs uses the text layer directly (pure-Python, no
    ML layout model); it only falls short on scanned/image-only PDFs, which
    are out of scope for this phase."""

    name = "unstructured"
    version = "1"

    @staticmethod
    def supports(mime_type: str | None, extension: str) -> bool:
        return extension.lower() in _EXTENSIONS or mime_type in _MIME_TYPES

    def parse(self, file_path: Path) -> ParsedDocument:
        if file_path.suffix.lower() == ".docx":
            from unstructured.partition.docx import partition_docx

            elements = partition_docx(filename=str(file_path))
        else:
            from unstructured.partition.pdf import partition_pdf

            elements = partition_pdf(filename=str(file_path), strategy="fast")

        sections: list[ParsedSection] = []
        current_heading: list[str] = [file_path.stem]
        current_page: int | None = None
        buffer: list[str] = []

        def flush() -> None:
            text = "\n\n".join(t for t in buffer if t.strip())
            if text.strip():
                sections.append(
                    ParsedSection(heading_path=list(current_heading), text=text, page_number=current_page)
                )
            buffer.clear()

        for el in elements:
            page = getattr(el.metadata, "page_number", None)
            if getattr(el, "category", None) == "Title" and el.text.strip():
                flush()
                current_heading = [file_path.stem, el.text.strip()]
                current_page = page
                continue
            if page is not None:
                current_page = page
            if el.text and el.text.strip():
                buffer.append(el.text.strip())
        flush()

        if not sections:
            full_text = "\n\n".join(el.text.strip() for el in elements if el.text and el.text.strip())
            if full_text:
                sections.append(ParsedSection(heading_path=[file_path.stem], text=full_text))

        return ParsedDocument(kind="text", sections=sections)
