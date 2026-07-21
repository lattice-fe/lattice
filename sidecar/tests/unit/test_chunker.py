from app.chunking.chunker import TOKEN_MAX, chunk_sections
from app.parsers.base import ParsedSection


def test_short_adjacent_sections_with_same_heading_merge():
    sections = [
        ParsedSection(heading_path=["Deck", "Slide 1"], text="short intro"),
        ParsedSection(heading_path=["Deck", "Slide 1"], text="more short content"),
    ]
    pieces = chunk_sections(sections)
    assert len(pieces) == 1
    assert "short intro" in pieces[0].text
    assert "more short content" in pieces[0].text


def test_sections_with_different_headings_do_not_merge():
    sections = [
        ParsedSection(heading_path=["Deck", "Slide 1"], text="first"),
        ParsedSection(heading_path=["Deck", "Slide 2"], text="second"),
    ]
    pieces = chunk_sections(sections)
    assert len(pieces) == 2


def test_long_section_is_split_and_stays_under_token_max():
    long_text = "\n\n".join(f"Paragraph number {i} with some filler words to add length." for i in range(200))
    sections = [ParsedSection(heading_path=["Doc"], text=long_text)]
    pieces = chunk_sections(sections)

    assert len(pieces) > 1
    for piece in pieces:
        assert piece.token_count <= TOKEN_MAX * 1.1  # small slack for paragraph granularity
    # heading_path/structural metadata carried through to every split piece
    assert all(p.structural_metadata["heading_path"] == ["Doc"] for p in pieces)


def test_page_and_slide_numbers_carried_into_metadata():
    sections = [ParsedSection(heading_path=["Doc"], text="hello", page_number=3, slide_number=None)]
    pieces = chunk_sections(sections)
    assert pieces[0].structural_metadata["page"] == 3
    assert "slide" not in pieces[0].structural_metadata


def test_empty_sections_produce_no_pieces():
    assert chunk_sections([]) == []
