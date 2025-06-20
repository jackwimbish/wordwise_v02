# /backend/app/database.py

import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

# Load environment variables from the .env file in the /backend directory
load_dotenv()

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
    # --- THIS IS THE FIX ---
    # This argument is passed directly to the asyncpg driver.
    # It disables the prepared statement cache, which is incompatible
    # with PgBouncer in transaction pooling mode.
    connect_args={"statement_cache_size": 0}
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

