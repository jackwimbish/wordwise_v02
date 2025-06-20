# Project Architecture & Tech Stack: AI Writing Assistant

## 1. High-Level Overview

This document outlines the complete technology stack and architectural decisions for the AI Writing Assistant application. The project is a full-stack web application designed to provide users with real-time, AI-powered writing suggestions, similar to services like Grammarly.

The architecture is built on a modern, decoupled stack, separating the frontend presentation layer from the backend business logic. This separation allows for independent development, scaling, and maintenance of each component.

---

## 2. Core Technology Choices

The stack is primarily built on TypeScript/JavaScript for the frontend and Python for the backend, leveraging best-in-class frameworks and services for each layer.

| Layer                     | Technology/Service                                       | Purpose                                                                 |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Frontend** | **Next.js** (with React & TipTap) & **Shadcn/ui** | User interface, rich text editing, and overall user experience.         | 
| **Backend** | **FastAPI** (with Python & SQLAlchemy)                   | Business logic, LLM integration, API services, and database interaction.| 
| **Database & Auth** | **Supabase** | PostgreSQL database, user authentication, and row-level security.       | 
| **Deployment** | **Vercel** (Frontend) & **Railway** (Backend)            | Hosting, CI/CD, and infrastructure management.                          | 
| **Observability** | **Sentry** | Error tracking and performance monitoring for both services.            | 
| **Database Migrations** | **Alembic** | Programmatic, version-controlled schema management.                     | 

---

## 3. Detailed Component Breakdown

### Frontend (Next.js)

* **Framework:** **Next.js** using the App Router and TypeScript. This provides a powerful foundation with features like server-side rendering (SSR), static site generation (SSG), and optimized performance out of the box. The project will use a `src/` directory for clean code organization.

* **Rich Text Editor:** **TipTap**. Chosen for its extensibility and solid foundation on ProseMirror. It allows us to create custom "decorations" for highlighting suggestions without altering the document's underlying structure.

* **UI Components:** **Shadcn/ui**. This is not a traditional component library but a collection of reusable components built with Radix UI and Tailwind CSS. We will use its CLI to copy component code directly into our project, giving us full ownership and customization capabilities.

* **Local Dev Server:** We will use **Turbopack** (`next dev --turbo`) for local development to leverage its significant speed improvements in server startup and hot-reloading.

### Backend (FastAPI)

* **Framework:** **FastAPI**. A modern, high-performance Python web framework chosen for its speed, automatic API documentation (via OpenAPI), and native support for asynchronous programming, which is crucial for handling I/O-bound operations like LLM and database calls.

* **Database ORM:** **SQLAlchemy** (with its `asyncio` extension). Chosen for its powerful Object-Relational Mapping capabilities and your familiarity with it. It allows us to interact with the database using Python objects and ensures that all database operations are non-blocking. The `asyncpg` driver will be used for connecting to PostgreSQL.

* **Business Logic:** The backend is the exclusive owner of all business logic. This includes communicating with the LLM provider, processing and filtering suggestions, calculating suggestion offsets, and handling user-specific rules like suggestion dismissals.

### Database & Authentication (Supabase)

* **Database:** Supabase provides a fully-managed **PostgreSQL** database. This gives us the power and flexibility of a relational database.

* **Authentication:** We will use **Supabase Auth** for user management (signup, login, password resets). It handles secure JWT (JSON Web Token) issuance, which our FastAPI backend will validate to protect its API endpoints.

* **User Data Pattern:** We will follow the standard Supabase pattern of creating a `public.profiles` table to store application-specific user data. This table is linked via a one-to-one relationship to the `auth.users` table and is automatically populated for new users via a PostgreSQL trigger.

### Deployment & Infrastructure

* **Frontend Deployment:** The Next.js frontend will be deployed on **Vercel**. Its seamless integration with Next.js provides automatic CI/CD, preview deployments for every pull request, and a global edge network for optimal performance.

* **Backend Deployment:** The FastAPI backend will be deployed on **Railway**. It was chosen for its excellent developer experience, easy integration with GitHub, and simple management of environment variables.

* **Database Migrations:** **Alembic** will be used to manage all database schema changes. It will be configured to use our SQLAlchemy models as the source of truth, allowing us to programmatically generate and apply version-controlled migrations.

### Observability

* **Error & Performance Monitoring:** **Sentry** will be integrated from the start. We will use the Sentry SDKs for both Next.js and FastAPI to automatically capture errors, monitor API performance, and gain visibility into the health of our application in real-time.
