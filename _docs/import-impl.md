# Feature Design Document: Document Import (.txt, .pdf, .docx)

This document outlines the user experience and technical implementation for a feature that allows users to create a new document by importing content from an existing file.

---

## 1. Feature Overview

**Goal:** To provide users with a seamless way to bring their existing work into the application from common file formats, reducing friction and making it easy to start using the app's analysis tools immediately.

**Supported Formats:**
* Plain Text (`.txt`)
* PDF (`.pdf`)
* Microsoft Word (`.docx`)

**Core Workflow:** The user selects a file on the frontend, which is uploaded to the backend. The backend extracts the text content and sends it back to the frontend to populate a new document in the editor.

---

## 2. User Experience (UX) Flow

1.  **Initiation:**
    * On the main user dashboard or in a prominent location, there will be an "Import Document" button.
    * Clicking this button opens the operating system's native file selection dialog. The dialog will be configured to only show supported file types (`.txt`, `.pdf`, `.docx`).

2.  **Upload & Processing:**
    * Once the user selects a file, the frontend will display a loading indicator (e.g., a "Processing..." toast or modal) to provide feedback that the file is being uploaded and parsed.

3.  **Completion:**
    * Upon successful processing, the user is automatically navigated to the main editor view, which is now populated with the extracted text from their uploaded document.
    * A new document will be created in their document list, often titled with the name of the imported file.

4.  **Error Handling:**
    * If the file is too large, corrupted, or in an unsupported format, a clear error message will be displayed to the user (e.g., "Failed to import file. Please ensure it is a valid .txt, .pdf, or .docx file under 10MB.").

---

## 3. Technical Implementation Plan

This feature requires a new backend endpoint for file processing and corresponding UI/logic on the frontend.

### 3.1. Backend (FastAPI)

The backend is responsible for securely receiving the file and extracting its text content.

#### **A. New Python Dependencies**

You will need to add libraries capable of parsing PDF and DOCX files to your `/backend/requirements.txt`:

For parsing .docx filespython-docxFor parsing .pdf files (PyMuPDF is fast and effective)PyMuPDFRemember to run `pip install -r requirements.txt` after adding them.

#### **B. New File Upload Endpoint**

* **Route:** `POST /api/v1/import/file`
* **Input:** The endpoint will expect a `multipart/form-data` request containing the file. FastAPI handles this elegantly with `UploadFile`.
* **Security:** This endpoint must be protected by your JWT authentication dependency. You should also enforce a file size limit directly in FastAPI to prevent abuse.

* **Algorithm:**
    1.  Receive the `UploadFile` object from the request.
    2.  Check the file's `content_type` or filename extension (e.g., `.pdf`) to determine which parser to use.
    3.  **Implement Parsers:**
        * **For `.docx`:** Use the `docx` library. Iterate through the `document.paragraphs` and join their `text` attributes with a newline character.
        * **For `.pdf`:** Use the `fitz` (PyMuPDF) library. Open the PDF from the uploaded file's bytes. Iterate through each `page`, call `page.get_text()`, and join the text from all pages.
        * **For `.txt`:** Simply read the file's bytes and decode them as UTF-8.
    4.  Handle potential parsing errors within each block (e.g., for a corrupted file) and return an appropriate HTTP error code.
    5.  **Return Response:** On success, return a JSON object containing the extracted text.
        ```json
        {
          "filename": "original_filename.docx",
          "content": "The full extracted text content..."
        }
        ```

### 3.2. Frontend (Next.js)

The frontend is responsible for the UI and for sending the file to the backend.

1.  **UI Implementation:**
    * Create an `<input type="file" />` element. It can be visually hidden and triggered by a user-friendly Shadcn/ui `Button`.
    * Use the `accept` attribute on the input to restrict file selection: `accept=".txt,.pdf,.docx"`.

2.  **File Handling Logic:**
    * Create an `onChange` handler for the file input.
    * When a file is selected, get the `File` object from the event (`event.target.files[0]`).
    * Perform a client-side check on the file size to provide instant feedback if it's too large, before even attempting the upload.

3.  **API Call:**
    * Create a `FormData` object.
    * Append the selected file to it: `formData.append("file", selectedFile)`.
    * Use your API client (`fetch` or `axios`) to `POST` this `FormData` object to your `/api/v1/import/file` backend endpoint. The browser will automatically set the correct `Content-Type: multipart/form-data` header.
    * Display a loading state while the request is in-flight.

4.  **Populating the Editor:**
    * When the API call returns a successful response with the extracted content:
        * First, make a call to your existing document CRUD endpoint to create a new document in the database, using the `filename` from the response as the `title`.
        * Then, navigate the user to the editor page for that new document's ID.
        * Initialize the TipTap editor with the `content` received from the import API call.

