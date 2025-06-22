# /backend/app/main.py

import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sentry_sdk
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# --- Environment Variable Loading ---
# It's good practice to load environment variables at the very start.
# This will load the variables from your /backend/.env file.
load_dotenv()

# --- Rate Limiter Configuration ---
# Initialize the rate limiter with remote address as the key function
limiter = Limiter(key_func=get_remote_address)

# --- Sentry Initialization ---
# This should be done as early as possible in your application's lifecycle.
sentry_dsn = os.getenv("SENTRY_DSN_BACKEND")
# We only want to enable Sentry in our deployed environments (e.g., 'production')
# and not during local development.
environment = os.getenv("APP_ENV", "development")

# We wrap the entire init call in a condition that checks both for a DSN
# AND that the environment is not 'development'.
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

# Add the rate limiter to the app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS (Cross-Origin Resource Sharing) Configuration ---
# This middleware allows your Next.js frontend (running on a different domain)
# to make requests to this FastAPI backend.

# Start with the local development origin
origins = [
    "http://localhost:3000",
]

# Conditionally add the production frontend URL if it's set
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

# It's also a good practice to allow Vercel preview URLs
# You could add another environment variable for the pattern, e.g.,
# VERCEL_PREVIEW_URL_PATTERN="https://*-your-team.vercel.app"
# Or handle it with a wildcard if your needs are simpler.


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)


# --- API Routers ---
# As your application grows, you'll organize endpoints into separate files (routers).
# We will include them here.
from .routers import documents, profiles, suggestions, rewriter

app.include_router(documents.router, prefix="/api/v1")
app.include_router(profiles.router, prefix="/api/v1")
app.include_router(suggestions.router, prefix="/api/v1")
app.include_router(rewriter.router, prefix="/api/v1")


# --- Root Endpoint / Health Check ---
# This is a simple endpoint to confirm that the API is running.
@app.get("/", tags=["Health Check"])
async def read_root():
    """
    A simple health check endpoint to confirm the API is up and running.
    """
    return {"status": "ok", "message": "Welcome to the AI Writing Assistant API!"}

