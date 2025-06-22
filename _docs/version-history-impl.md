# Implementation Plan: Document Version History

This document outlines the step-by-step implementation plan for the document version history feature. The goal is to automatically save previous versions of a document, allowing users to view and restore them.

---

## **Phase 1: Backend & Database Setup**

This phase focuses on building the foundational database structure and backend logic required to capture version history.

### **Step 1.1: Create the Database Table**

Create a new table in the Supabase database to store historical versions.

* **Action:** Add the following SQLAlchemy model to `/backend/app/models.py`.

    ```python
    # In /backend/app/models.py, alongside your other models

    class DocumentVersion(Base):
        __tablename__ = "document_versions"

        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        document_id = Column(
            UUID(as_uuid=True),
            ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )
        content = Column(Text) # The content of the document at this point in time
        saved_at = Column(
            TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
        )

        document = relationship("Document")
    ```

### **Step 1.2: Run Database Migration**

Apply the schema change to your live database.

* **Action:** Run the following Alembic commands in your backend directory.
    1.  `alembic revision --autogenerate -m "add document_versions table"`
    2.  `alembic upgrade head`
* **Verification:** Confirm the `document_versions` table has been created in your Supabase dashboard.

### **Step 1.3: Update the Document Save Logic**

Modify the existing "Save/Update Document" endpoint (e.g., `PUT /api/v1/documents/{document_id}`) to archive the previous version before saving the new one.

* **Implementation Algorithm:**
    1.  Receive the request to update a document with new content and authenticate the user.
    2.  **Fetch Current State:** Before applying the update, perform a `SELECT` query to get the *current* `content` from the `documents` table for the given `document_id`. This is the state to be archived.
    3.  **Create Historical Version:** Create a new `DocumentVersion` SQLAlchemy object, populating it with the `document_id` and the `content` fetched in the previous step.
    4.  **Update Live Document:** Proceed with the original logic to update the row in the `documents` table with the *new* content from the user's request.
    5.  **Commit Transaction:** Commit the session. This will atomically save both the new historical version to `document_versions` and update the live record in `documents`.

---

## **Phase 2: Frontend User Experience (Future Milestone)**

This phase focuses on building the user-facing interface for viewing and restoring versions. The backend work from Phase 1 correctly captures all necessary data to enable this UI.

### **Step 2.1: Implement the UI Entry Point**

* **Action:** Add a "Version History" button or menu item to the editor toolbar.

### **Step 2.2: Build the History Viewer**

* **Action:** Create the UI for displaying the version history.
    * **Recommended UI:** A side panel (`Sheet` component) that opens next to the editor.
    * The panel will fetch and display a list of all saved versions for the current document, showing the `saved_at` timestamp for each.
    * When a user clicks a version, its content should be displayed in a read-only view. A diff viewer comparing it to the current version is highly recommended for clarity.

### **Step 2.3: Implement the "Restore" Functionality**

* **Action:** Add a "Restore" button to each version in the history viewer.
* **Implementation Algorithm:**
    1.  When "Restore" is clicked, get the content of the selected historical version.
    2.  **Crucial Safety Step:** Before overwriting, trigger your standard document save logic to save the *current* editor content as a new historical version. This ensures no work is lost.
    3.  Once the current state is safely archived, update the TipTap editor's content with the content from the restored version.

