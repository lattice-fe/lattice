import uuid

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.principals import Principal


def get_current_principal(
    x_principal_external_id: str = Header(
        default="lattice-local",
        description="Stand-in for a real identity provider. Defaults to the single "
        "local desktop user so the bundled web UI and Lattice share one principal.",
    ),
    db: Session = Depends(get_db),
) -> Principal:
    """Stubbed identity resolution: reads an opaque external id from a header
    and looks up (or, for now, creates) the matching Principal row. This is
    the seam a real identity provider (SSO/OIDC claims, etc.) slots into
    later without touching any call site that depends on
    get_current_principal — auto-create is a dev-only convenience for that
    stub and should be dropped once a real identity provider sits in front
    of this; it does not weaken the ACL model itself, since a freshly
    created principal still has zero scope grants until explicitly added."""
    principal = db.execute(
        select(Principal).where(Principal.external_id == x_principal_external_id)
    ).scalar_one_or_none()
    if principal is None:
        principal = Principal(type="user", external_id=x_principal_external_id)
        db.add(principal)
        db.commit()
    return principal


def current_principal_id(principal: Principal = Depends(get_current_principal)) -> uuid.UUID:
    return principal.id
