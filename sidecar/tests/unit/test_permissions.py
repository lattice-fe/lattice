import pytest

from app.models.scopes import permission_at_least


@pytest.mark.parametrize(
    "granted,required,expected",
    [
        ("read", "read", True),
        ("write", "read", True),
        ("admin", "read", True),
        ("admin", "write", True),
        ("admin", "admin", True),
        ("read", "write", False),
        ("read", "admin", False),
        ("write", "admin", False),
    ],
)
def test_permission_at_least(granted, required, expected):
    assert permission_at_least(granted, required) is expected
