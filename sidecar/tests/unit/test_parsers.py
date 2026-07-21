from pathlib import Path

from app.parsers.pdf_docx_parser import PdfDocxParser
from app.parsers.pptx_parser import PptxParser
from app.parsers.tabular_parser import TabularParser
from app.parsers.text_parser import TextParser
from tests.fixtures.generators import make_csv, make_docx, make_md, make_pptx, make_txt, make_xlsx


def test_pptx_parser_extracts_per_slide_sections(tmp_path: Path):
    file_path = make_pptx(tmp_path / "deck.pptx")
    parsed = PptxParser().parse(file_path)

    assert parsed.kind == "text"
    assert len(parsed.sections) == 2
    assert parsed.sections[0].slide_number == 1
    assert parsed.sections[1].heading_path == ["Q3 Planning", "Goals"]
    assert "Ship the ingestion backbone" in parsed.sections[1].text
    assert "speaker notes" in parsed.sections[1].text
    assert "pointer index rollup" in parsed.sections[1].text


def test_tabular_parser_routes_xlsx_to_tables_not_chunks(tmp_path: Path):
    file_path = make_xlsx(tmp_path / "budget.xlsx")
    parsed = TabularParser().parse(file_path)

    assert parsed.kind == "tabular"
    assert parsed.sections == []
    table_names = {t.table_name for t in parsed.tables}
    assert table_names == {"Budget", "Headcount"}

    budget = next(t for t in parsed.tables if t.table_name == "Budget")
    assert budget.row_count == 2
    assert {c["name"] for c in budget.columns} == {"team", "quarter", "spend"}
    assert budget.rows[0]["team"] == "platform"


def test_tabular_parser_handles_csv(tmp_path: Path):
    file_path = make_csv(tmp_path / "notes.csv")
    parsed = TabularParser().parse(file_path)

    assert parsed.kind == "tabular"
    assert parsed.tables[0].table_name == "csv"
    assert parsed.tables[0].row_count == 2


def test_text_parser_markdown_builds_heading_path(tmp_path: Path):
    file_path = make_md(tmp_path / "notes.md")
    parsed = TextParser().parse(file_path)

    heading_paths = [s.heading_path for s in parsed.sections]
    assert ["notes", "Sprint Notes"] in heading_paths or ["notes"] in [hp[:1] for hp in heading_paths]
    decisions_section = next(s for s in parsed.sections if s.heading_path[-1] == "Decisions")
    assert "ship the backbone" in decisions_section.text.lower()


def test_text_parser_txt_has_no_structure_flag(tmp_path: Path):
    file_path = make_txt(tmp_path / "note.txt")
    parsed = TextParser().parse(file_path)

    assert len(parsed.sections) == 1
    assert parsed.sections[0].metadata.get("no_structure") is True
    assert "second paragraph" in parsed.sections[0].text


def test_pdf_docx_parser_extracts_headings_from_docx(tmp_path: Path):
    file_path = make_docx(tmp_path / "review.docx")
    parsed = PdfDocxParser().parse(file_path)

    assert parsed.kind == "text"
    assert len(parsed.sections) >= 1
    all_text = "\n".join(s.text for s in parsed.sections)
    assert "design review outcome" in all_text.lower()
    open_questions = [s for s in parsed.sections if "Open Questions" in s.heading_path]
    assert open_questions, f"expected an Open Questions section, got {[s.heading_path for s in parsed.sections]}"
