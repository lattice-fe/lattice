from pathlib import Path

from app.parsers.base import ParsedDocument, Parser, TableSpec

_EXTENSIONS = {".xlsx", ".xlsm", ".csv"}
_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
}

_SAMPLE_SIZE = 3


class TabularParser(Parser):
    """xlsx/csv never get chunked or embedded — semantic search over
    spreadsheet cells is a poor fit. Rows land in TabularRow for a future
    SQL/pandas-style query tool; this just produces the schema/shape summary
    plus the raw rows for that table's storage."""

    name = "tabular"
    version = "1"

    @staticmethod
    def supports(mime_type: str | None, extension: str) -> bool:
        return extension.lower() in _EXTENSIONS or mime_type in _MIME_TYPES

    def parse(self, file_path: Path) -> ParsedDocument:
        import pandas as pd

        ext = file_path.suffix.lower()
        if ext == ".csv":
            sheets = {"csv": pd.read_csv(file_path)}
        else:
            sheets = pd.read_excel(file_path, sheet_name=None, engine="openpyxl")

        tables = [_table_spec(name, df) for name, df in sheets.items()]
        return ParsedDocument(kind="tabular", tables=tables, raw_metadata={"sheet_names": list(sheets.keys())})


def _table_spec(table_name: str, df) -> TableSpec:
    import pandas as pd

    columns = []
    for col in df.columns:
        series = df[col]
        samples = [_jsonable(v) for v in series.dropna().head(_SAMPLE_SIZE).tolist()]
        columns.append(
            {
                "name": str(col),
                "dtype": str(series.dtype),
                "null_rate": float(series.isna().mean()) if len(series) else 0.0,
                "sample_values": samples,
            }
        )

    clean = df.where(pd.notnull(df), None)
    rows = [{str(k): _jsonable(v) for k, v in row.items()} for row in clean.to_dict(orient="records")]

    return TableSpec(table_name=str(table_name), columns=columns, row_count=len(df), rows=rows)


def _jsonable(value):
    import pandas as pd

    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    return str(value)
