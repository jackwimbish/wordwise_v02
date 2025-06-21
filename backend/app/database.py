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
# For our persistent server on Railway, we use the DIRECT (NON_POOLING) URL.
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# --- SQLAlchemy Async Engine (Updated for Direct Connection) ---
# The engine is the entry point to the database. It manages connections.
# Since we are using a direct connection, we now want SQLAlchemy to manage
# its own connection pool for high performance.
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Set to True to see all generated SQL statements
    # SQLAlchemy will now use its default, high-performance async connection pool.
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

