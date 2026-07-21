import pytest

from app.parsers.base import UnsupportedFileTypeError
from app.parsers.pdf_docx_parser import PdfDocxParser
from app.parsers.pptx_parser import PptxParser
from app.parsers.registry import get_parser
from app.parsers.tabular_parser import TabularParser
from app.parsers.text_parser import TextParser


@pytest.mark.parametrize(
    "extension,mime_type,expected",
    [
        (".pptx", None, PptxParser),
        (".pdf", None, PdfDocxParser),
        (".docx", None, PdfDocxParser),
        (".xlsx", None, TabularParser),
        (".csv", None, TabularParser),
        (".md", None, TextParser),
        (".txt", None, TextParser),
    ],
)
def test_registry_dispatches_by_extension(extension, mime_type, expected):
    parser = get_parser(mime_type, extension)
    assert isinstance(parser, expected)


def test_registry_raises_for_unknown_extension():
    with pytest.raises(UnsupportedFileTypeError):
        get_parser(None, ".exe")
