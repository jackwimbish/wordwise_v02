# Incremental Implementation Plan: AI Writing Assistant

This plan breaks down the development of the application into manageable milestones. Each milestone concludes with a deployment checkpoint to verify its functionality in a live environment.

---

### **Milestone 1: Project Setup & "Hello World" Deployment**

**Goal:** Ensure the entire CI/CD and deployment pipeline is working from end to end before any significant application code is written.

* **Tasks:**
    1.  **Project Setup:** Complete the "Pre-Flight Checklist." This includes creating the GitHub repository, Supabase project, Vercel & Railway projects, Sentry projects, and setting up the local development environment with all necessary credentials in `.env` files.
    2.  **Backend (FastAPI):**
        * Create the `main.py` file with a single health check endpoint at `GET /api/v1/health` that returns `{"status": "ok"}`.
        * Configure CORS middleware in `main.py` to allow requests from your future Vercel domain and `localhost`.
    3.  **Frontend (Next.js):**
        * Create a simple page that makes a `fetch` request to the backend's `/api/v1/health` endpoint.
        * Display the status message from the backend on the page.
    4.  **Deployment Prep:**
        * Create the `Procfile` in the `/backend` directory.
        * Create and populate the `requirements.txt` file.

* **Deployment Checkpoint 1:**
    * Deploy the `main` branch to Vercel and Railway.
    * **Success Criteria:** Open your live Vercel URL. It must successfully fetch the message from your live Railway backend and display it. This validates the entire communication pipeline.

---

### **Milestone 2: User Authentication & Document CRUD**

**Goal:** Implement the full user lifecycle and the basic ability to create, save, and view documents.

* **Tasks:**
    1.  **Backend (FastAPI, SQLAlchemy, Alembic):**
        * Finalize `database.py`, `models.py` (with `Profile`, `Document` models), and `alembic/env.py`.
        * Run `alembic revision --autogenerate` and `alembic upgrade head` to create your initial tables in the Supabase database.
        * Set up the PostgreSQL trigger in the Supabase UI to auto-create profiles for new users.
        * Create protected CRUD (Create, Read, Update, Delete) API endpoints for documents. Secure them using your JWT validation dependency.
    2.  **Frontend (Next.js, Supabase, Shadcn/ui):**
        * Use the official Supabase Auth helpers and Shadcn/ui components to build login, signup, and logout functionality.
        * Create a protected dashboard page that lists a user's documents by fetching from your backend.
        * Allow users to create a new document, which navigates them to a document-specific page. For now, this page can use a simple `<textarea>`.

* **Deployment Checkpoint 2:**
    * Deploy the updated services.
    * **Success Criteria:** A new user can sign up on the live site. They can log in and out. They can create a document, type in it, save it, and see it in their document list.

---

### **Milestone 3: Rich Text Editor & Static Highlights**

**Goal:** Replace the `<textarea>` with a fully functional TipTap editor and validate the complex client-side highlight logic using hardcoded data.

* **Tasks:**
    1.  **Frontend (Next.js & TipTap):**
        * Integrate the TipTap editor onto the document page.
        * Implement the custom TipTap `SuggestionExtension` to apply "decorations" (styled underlines).
        * Implement the system for assigning and managing stable, unique IDs for each paragraph node.
        * Create a hardcoded array of suggestion objects within the frontend state.
        * Implement the full client-side transformation logic using `onTransaction` to ensure the hardcoded highlights move and disappear correctly as the user types.
    2.  **Backend:** No changes in this step.

* **Deployment Checkpoint 3:**
    * Deploy the frontend.
    * **Success Criteria:** Open a document on the live site. Verify that the hardcoded highlights appear. Type and delete text around the highlights to confirm they "stick" to the text and are correctly invalidated when typed over.

---

### **Milestone 4: Live LLM Suggestions**

**Goal:** Connect the editor to the backend to get real, AI-powered suggestions.

* **Tasks:**
    1.  **Backend (FastAPI):**
        * Implement the full `POST /api/v1/suggestions` endpoint.
        * It must accept an array of "dirty" paragraphs with their `paragraph_id` and `base_offset`.
        * It must construct the detailed LLM prompt requiring a `rule_id`.
        * It must call the LLM, process the response, calculate final global offsets, and handle LLM errors gracefully by logging to Sentry and returning an empty list for the failed paragraph.
        * Implement payload and paragraph size limits.
    2.  **Frontend (Next.js):**
        * Remove the hardcoded suggestion array.
        * Implement the paragraph-level change detection using content hashing.
        * Implement the debounced API call that sends only the dirty paragraphs to the backend.
        * Implement the logic to receive the new suggestions and merge them into the local state, which will trigger the `SuggestionExtension` to render the highlights.

* **Deployment Checkpoint 4:**
    * Deploy both services.
    * **Success Criteria:** Type a sentence with a clear error. After the debounce period, the text should be highlighted, and clicking it should show the correct suggestion from the LLM.

---

### **Milestone 5: Suggestion Interaction & Dismissal**

**Goal:** Make the suggestions fully interactive and allow users to dismiss them permanently for a document.

* **Tasks:**
    1.  **Backend (FastAPI & Alembic):**
        * Add the `DismissedSuggestion` model to `models.py` and run `alembic` to update your database schema.
        * Implement the `POST /api/v1/suggestions/dismiss` endpoint.
        * Modify the `/suggestions` endpoint to fetch and filter suggestions based on the user's dismissals for that document.
    2.  **Frontend (Next.js):**
        * Build the suggestion card UI using Shadcn/ui components (`Popover`, `Card`, `Button`).
        * Wire up the "Accept" button to apply the change to the editor using a TipTap transaction.
        * Wire up the "Dismiss" button to call the `/dismiss` backend endpoint and remove the suggestion from the local UI.

* **Deployment Checkpoint 5:**
    * Deploy both services.
    * **Success Criteria:** You can accept a suggestion, and the text updates correctly. You can dismiss a suggestion, it disappears, and it does not reappear on a subsequent analysis of that paragraph.

---

### **Milestone 6: Final Polish & Launch Prep**

**Goal:** Clean up the UI, add missing quality-of-life features, and prepare for a public launch.

* **Tasks:**
    * Review and refine the entire UI for consistency and polish.
    * Write end-to-end tests for the core user flows (signup, create document, get suggestion, accept/dismiss).
    * Review Sentry logs for any common errors that appeared during testing.
    * Consider adding UI loading states for suggestion analysis if needed.

* **Deployment Checkpoint 6:**
    * Final production deployment.
    * **Success Criteria:** The application is stable, polished, and ready for users.

