# Feature Design Document: Document Export (.txt, .pdf, .docx)

This document outlines the user experience and technical implementation for a feature that allows users to export their documents into various common file formats.

---

## 1. Feature Overview

**Goal:** To allow users to easily download their work from the application in standard, portable file formats, enabling them to share, print, or archive their documents outside of the app.

**Supported Formats:**
* Plain Text (`.txt`)
* PDF (`.pdf`)
* Microsoft Word (`.docx`)

**Core Workflow:** The user selects an export format from a menu in the editor. The frontend sends the current document content to the backend. The backend generates the corresponding file and streams it back to the user's browser, triggering a download.

---

## 2. User Experience (UX) Flow

1.  **Initiation:**
    * In the main editor toolbar, there will be an "Export" button or a "File" menu.
    * Clicking this reveals a dropdown menu with the available format options: "Export as .txt", "Export as .pdf", "Export as .docx".

2.  **File Generation & Download:**
    * When the user selects a format (e.g., "Export as .pdf"), a request is sent to the backend.
    * The browser will then initiate a file download.
    * The downloaded file's name will be automatically set based on the document's title (e.g., `My-Feature-Story.pdf`).

3.  **Feedback (Optional but Recommended):**
    * While the backend is generating the file (which should be very fast for most documents), the frontend can show a brief "Preparing your download..." toast notification.

---

## 3. Technical Implementation Plan

This feature requires a new backend endpoint for file generation and corresponding UI/logic on the frontend to handle the download.

### 3.1. Backend (FastAPI)

The backend is responsible for receiving the document content and converting it into the specified file format.

#### **A. New Python Dependencies**

You will need to ensure you have libraries for both creating DOCX files and generating PDFs.

in /backend/requirements.txtAlready included for import, also used for creating .docx filespython-docxFor generating .pdf files. ReportLab is a powerful choice.reportlabRemember to run `pip install -r requirements.txt` after adding them.

#### **B. New File Export Endpoint**

* **Route:** `POST /api/v1/export/file`
* **Input:** The endpoint will expect a JSON request body containing the document's content and the desired format.
    ```json
    {
      "title": "My Document Title",
      "content": "The full text content of the document...",
      "format": "pdf" // or "docx", "txt"
    }
    ```
* **Security:** This endpoint must be protected by your JWT authentication dependency.

* **Algorithm:**
    1.  Receive the JSON request body.
    2.  Use an `if/elif/else` block to check the `format` field.
    3.  **Implement Generators:**
        * **For `docx`:** Create a new `docx.Document` object. Add the content to it as paragraphs. Save the document to an in-memory byte stream (`io.BytesIO`).
        * **For `pdf`:** Use the `reportlab` library to create a new PDF document in memory. Add the content to the document. This is more complex as you may need to handle text flow and paragraph breaks.
        * **For `txt`:** This is the simplest. Just encode the `content` string into bytes (`content.encode('utf-8')`).
    4.  **Return Response:** Use FastAPI's `StreamingResponse` or `Response` object to send the file back to the client. This is the crucial part.
        * Set the `media_type` to the appropriate MIME type (e.g., `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
        * Set the `Content-Disposition` header to `attachment; filename="your_document_title.pdf"`. This tells the browser to trigger a download dialog instead of trying to display the file.

### 3.2. Frontend (Next.js)

The frontend is responsible for the UI, sending the document content, and handling the file download response.

1.  **UI Implementation:**
    * Create an "Export" `DropdownMenu` component using Shadcn/ui.
    * Populate it with menu items for each supported format.

2.  **File Handling Logic:**
    * When a user clicks an export option (e.g., "Export as .pdf"):
        * a. **Get Content:** Get the current document content from your TipTap editor instance. You can get it as plain text (`editor.getText()`).
        * b. **API Call:** Use your API client to `POST` the content, title, and desired format to the `/api/v1/export/file` endpoint. **Crucially**, you must configure your API client to expect a `blob` as the response type, not JSON.
        * c. **Trigger Download:** The API response will be the file itself as a binary blob. You cannot simply read this like JSON. The logic should be:
           ```javascript
           // responseBlob is the file data from the API
           const url = window.URL.createObjectURL(responseBlob);
           const link = document.createElement('a');
           link.href = url;
           link.setAttribute('download', 'your_document_title.pdf'); // Set the filename
           document.body.appendChild(link);
           link.click();
           link.parentNode.removeChild(link); // Clean up the link
           ```
        This sequence of creating a temporary URL and programmatically clicking a hidden link is the standard, cross-browser compatible way to trigger a file download from an API response.

