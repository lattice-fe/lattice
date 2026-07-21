from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


class UnsupportedFileTypeError(Exception):
    """Permanent failure — no parser registered for this file type. Never retried."""


@dataclass
class ParsedSection:
    heading_path: list[str]
    text: str
    page_number: int | None = None
    slide_number: int | None = None
    metadata: dict = field(default_factory=dict)


@dataclass
class TableSpec:
    table_name: str
    columns: list[dict]  # [{"name", "dtype", "null_rate", "sample_values"}]
    row_count: int
    rows: list[dict]  # raw row dicts, keyed by column name


@dataclass
class ParsedDocument:
    kind: Literal["text", "tabular"]
    sections: list[ParsedSection] = field(default_factory=list)
    tables: list[TableSpec] = field(default_factory=list)
    raw_metadata: dict = field(default_factory=dict)


class Parser(ABC):
    """Registered in priority order in the parser registry; the first
    supports() match wins. New file types plug in here without touching
    pipeline core."""

    name: str = "base"
    version: str = "1"

    @staticmethod
    @abstractmethod
    def supports(mime_type: str | None, extension: str) -> bool: ...

    @abstractmethod
    def parse(self, file_path: Path) -> ParsedDocument: ...
