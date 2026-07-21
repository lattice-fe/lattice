from pathlib import Path

from app.parsers.base import ParsedDocument, Parser, UnsupportedFileTypeError
from app.parsers.pdf_docx_parser import PdfDocxParser
from app.parsers.pptx_parser import PptxParser
from app.parsers.tabular_parser import TabularParser
from app.parsers.text_parser import TextParser

# Priority-ordered; first supports() match wins.
_REGISTRY: list[Parser] = [
    PptxParser(),
    PdfDocxParser(),
    TabularParser(),
    TextParser(),
]


def get_parser(mime_type: str | None, extension: str) -> Parser:
    for parser in _REGISTRY:
        if parser.supports(mime_type, extension):
            return parser
    raise UnsupportedFileTypeError(f"no parser registered for extension={extension!r} mime_type={mime_type!r}")


def parse_file(file_path: Path, mime_type: str | None, extension: str) -> tuple[ParsedDocument, Parser]:
    parser = get_parser(mime_type, extension)
    return parser.parse(file_path), parser
