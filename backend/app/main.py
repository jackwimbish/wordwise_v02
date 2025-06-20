# /backend/app/main.py

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sentry_sdk

# --- Environment Variable Loading ---
# It's good practice to load environment variables at the very start.
# This will load the variables from your /backend/.env file.
load_dotenv()

# --- Sentry Initialization ---
# This should be done as early as possible in your application's lifecycle.
sentry_dsn = os.getenv("SENTRY_DSN_BACKEND")
# We only want to enable Sentry in our deployed environments (e.g., 'production')
# and not during local development.
environment = os.getenv("APP_ENV", "development")

if sentry_dsn and environment != "development":
    sentry_sdk.init(
        dsn=sentry_dsn,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        # Adjust this value in production.
        traces_sample_rate=1.0,
        # Set profiles_sample_rate to 1.0 to profile 100%
        # of sampled transactions.
        # Adjust this value in production.
        profiles_sample_rate=1.0,
        # Explicitly set the environment
        environment=environment,
    )

# --- FastAPI App Initialization ---
app = FastAPI(
    title="AI Writing Assistant Backend",
    description="API for providing real-time writing suggestions.",
    version="1.0.0"
)

# --- CORS (Cross-Origin Resource Sharing) Configuration ---
# This middleware allows your Next.js frontend (running on a different domain)
# to make requests to this FastAPI backend.
origins = [
    "http://localhost:3000",  # For local frontend development
    # Add your Vercel production and preview URLs here
    # "https://your-production-domain.com",
    # It's good practice to use an environment variable for this in production
    os.getenv("FRONTEND_URL", "http://localhost:3000")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)


# --- API Routers ---
# As your application grows, you'll organize endpoints into separate files (routers).
# We will include them here. For now, we can create placeholder routers.
# For example:
# from .routers import documents, suggestions, auth
#
# app.include_router(documents.router)
# app.include_router(suggestions.router)
# app.include_router(auth.router)


# --- Root Endpoint / Health Check ---
# This is a simple endpoint to confirm that the API is running.
@app.get("/", tags=["Health Check"])
async def read_root():
    """
    A simple health check endpoint to confirm the API is up and running.
    """
    return {"status": "ok", "message": "Welcome to the AI Writing Assistant API!"}

