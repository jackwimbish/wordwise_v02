# /backend/app/database.py

import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

# Load environment variables from the .env file in the /backend directory
load_dotenv()

print(f"DATABASE_URL loaded: {os.getenv('DATABASE_URL') is not None}")
print(f"Current working directory: {os.getcwd()}")

# --- Database Connection String ---
# This is the most important part. We retrieve the connection string for your
# Supabase database from the environment variables.
# In production on Railway, you will set this as a secret.
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# --- SQLAlchemy Async Engine ---
# The engine is the entry point to the database. It manages connections.
# For a connection pooler like Supabase's PgBouncer, it's recommended to
# disable SQLAlchemy's own connection pooling by setting `poolclass=None`.
# PgBouncer handles the connection pooling for us.
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set to True to see all generated SQL statements
    poolclass=None, # Recommended for use with PgBouncer
    # --- AGGRESSIVE PGBOUNCER COMPATIBILITY ---
    # These arguments are passed directly to the asyncpg driver.
    # They completely disable prepared statements and caching features
    # that are incompatible with PgBouncer in transaction pooling mode.
    connect_args={
        "statement_cache_size": 0,  # Disable prepared statement cache
        "prepared_statement_cache_size": 0,  # Disable prepared statement cache (alternative name)
        "prepared_statement_name_func": None,  # Disable prepared statement naming
        "command_timeout": 60,  # Set command timeout
        "server_settings": {
            "jit": "off",  # Disable JIT compilation which can cause issues with PgBouncer
            "plan_cache_mode": "force_custom_plan",  # Force custom plans instead of cached plans
        }
    },
    # Additional SQLAlchemy settings for PgBouncer compatibility
    pool_pre_ping=True,  # Validate connections before use
    pool_recycle=300,   # Recycle connections every 5 minutes (more aggressive)
    pool_reset_on_return='commit',  # Reset connections on return
)

# --- SQLAlchemy Async Session Factory ---
# The async_sessionmaker creates new AsyncSession objects when called.
# This factory is what our application will use to get a database session
# for each request.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False, # Prevents attached objects from being expired after commit
    autoflush=False,
)

# --- Declarative Base ---
# All of our SQLAlchemy ORM models will inherit from this Base class.
# It allows SQLAlchemy to map our Python classes to database tables.
Base = declarative_base()


# --- Dependency for FastAPI Routes ---
# This function is a FastAPI dependency. When a route depends on this function,
# FastAPI will execute it before the route's logic. It provides a clean way
# to manage the lifecycle of a database session for a single API request.
async def get_db_session() -> AsyncSession:
    """
    Dependency that provides a database session to the API endpoints.
    Ensures that the session is always closed after the request is finished.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            # This block will be executed whether the request was successful
            # or an error occurred. It ensures the session is closed.
            await session.close()

