"""update_profile_trigger_for_api_call_count

Revision ID: 50e81b39d14b
Revises: d78300b23355
Create Date: 2025-06-22 14:10:45.287892+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '50e81b39d14b'
down_revision: Union[str, Sequence[str], None] = 'd78300b23355'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Update the trigger function to include api_call_count with default value
    op.execute("""
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $$
    BEGIN
      INSERT INTO public.profiles (id, email, api_call_count)
      VALUES (new.id, new.email, 0);
      RETURN new;
    END;
    $$;
    """)


def downgrade() -> None:
    """Downgrade schema."""
    # Revert to the old trigger function without api_call_count
    op.execute("""
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER SET search_path = public
    AS $$
    BEGIN
      INSERT INTO public.profiles (id, email)
      VALUES (new.id, new.email);
      RETURN new;
    END;
    $$;
    """)
