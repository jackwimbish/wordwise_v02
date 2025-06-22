# WordWise - AI Writing Assistant

WordWise is a full-stack AI Writing Assistant application that provides real-time writing suggestions, similar to Grammarly. It features a modern Next.js frontend with a rich text editor and a FastAPI backend powered by AI language models.

## 🚀 Features

- **Real-time AI Suggestions**: Get intelligent writing suggestions as you type
- **Rich Text Editor**: TipTap-based editor with advanced text editing capabilities
- **User Authentication**: Secure user accounts with Supabase Auth
- **Document Management**: Create, save, and manage your documents
- **Suggestion Interaction**: Accept or dismiss suggestions with full control
- **Version History**: Track changes to your documents over time
- **Readability Score**: Get insights into your text's readability
- **Export Functionality**: Export documents in various formats
- **Rate Limiting**: Built-in rate limiting for API protection

## 🛠 Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **TipTap** - Rich text editor built on ProseMirror
- **Shadcn/ui** - Modern UI components with Radix UI and Tailwind CSS
- **Zustand** - Lightweight state management
- **Supabase** - Authentication and database client

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - Async ORM for database operations
- **Alembic** - Database migration management
- **OpenAI API** - AI language model integration
- **Supabase** - PostgreSQL database and authentication
- **Sentry** - Error tracking and performance monitoring

### Infrastructure
- **Vercel** - Frontend deployment
- **Railway** - Backend deployment
- **Supabase** - Database and authentication services

## 📋 Prerequisites

Before setting up the project, ensure you have:

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **Git**
- **Supabase Account**
- **OpenAI API Key**
- **Sentry Account** (optional, for monitoring)

## 🔧 Local Development Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd wordwise_v02
```

### 2. Backend Setup

#### Navigate to backend directory:
```bash
cd backend
```

#### Create and activate virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

#### Install dependencies:
```bash
pip install -r requirements.txt
```

#### Environment Configuration:
Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@host:port/database

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Sentry (optional)
SENTRY_DSN=your_sentry_dsn

# App Settings
FRONTEND_URL=http://localhost:3000
```

#### Database Setup:
```bash
# Run database migrations
alembic upgrade head
```

#### Start the backend server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

#### Navigate to frontend directory:
```bash
cd frontend
```

#### Install dependencies:
```bash
npm install
```

#### Environment Configuration:
Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

NEXT_PUBLIC_SENTRY_DSN_FRONTEND=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth
```

#### Start the development server:
```bash
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🏗 Project Structure

```
wordwise_v02/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── database.py     # Database configuration
│   │   ├── models.py       # SQLAlchemy models
│   │   ├── schemas.py      # Pydantic schemas
│   │   ├── auth.py         # Authentication utilities
│   │   └── routers/        # API route handlers
│   ├── alembic/            # Database migrations
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # Utility libraries
│   │   └── types/         # TypeScript type definitions
│   └── package.json       # Node.js dependencies
└── _docs/                 # Project documentation
```

## 🔒 Authentication Setup

### Supabase Configuration

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Set up authentication** in the Supabase dashboard:
   - Enable email/password authentication
   - Configure redirect URLs for your domain

3. **Database Setup**: The application will automatically create the necessary tables through Alembic migrations.

4. **Row Level Security**: Ensure RLS is enabled on your tables for data security.

## 🚀 Deployment

### Frontend (Vercel)

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_BACKEND_URL`
   - `NEXT_PUBLIC_SENTRY_DSN_FRONTEND`
   - `SENTRY_AUTH_TOKEN`

### Backend (Railway)

1. **Connect your repository** to Railway
2. **Set environment variables** in Railway dashboard:
   - All the environment variables from your local `.env` file
3. **Configure the start command**: `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`

## 📚 Usage

### Getting Started

1. **Sign Up**: Create a new account or sign in with existing credentials
2. **Create Document**: Click "New Document" to start writing
3. **Write & Edit**: Use the rich text editor with real-time AI suggestions
4. **Manage Suggestions**: Click on highlighted text to accept or dismiss suggestions
5. **Save & Export**: Your documents are automatically saved and can be exported

### Key Features

#### AI Suggestions
- Type naturally in the editor
- AI suggestions appear as underlined text after a brief delay
- Click suggestions to see improvement options
- Accept suggestions to apply changes instantly
- Dismiss suggestions you don't want to see again
- Get shortening/lengthening recommendations by paragraph for a target document length

#### Document Management
- All documents are automatically saved
- Access your document library from the dashboard
- Version history tracks all changes
- Export documents in multiple formats

#### Readability Analysis
- Real-time readability scoring
- Suggestions for improving text clarity
- Grade-level analysis

## 🔧 Development

### Database Migrations

When making changes to the database schema:

```bash
cd backend
source .venv/bin/activate

# Generate a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head
```

### Adding New Dependencies

#### Backend:
```bash
cd backend
source .venv/bin/activate
pip install package_name
pip freeze > requirements.txt
```

#### Frontend:
```bash
cd frontend
npm install package_name
```

### Code Quality

#### Frontend:
```bash
npm run lint          # ESLint
npm run type-check    # TypeScript checking
npm run build         # Production build test
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify your `DATABASE_URL` is correct
   - Ensure your database is running and accessible
   - Check if migrations have been applied: `alembic current`

2. **Authentication Issues**
   - Verify Supabase environment variables
   - Check if authentication is properly configured in Supabase dashboard
   - Ensure redirect URLs are set correctly

3. **API Connection Issues**
   - Verify `NEXT_PUBLIC_BACKEND_URL` points to your running backend
   - Check CORS configuration in the backend
   - Ensure both frontend and backend are running

4. **Build Issues**
   - Run `npm run build` to check for TypeScript errors
   - Verify all environment variables are set
   - Check for missing dependencies

## 📖 API Documentation

The FastAPI backend automatically generates interactive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

**Happy Writing with WordWise! ✍️** 