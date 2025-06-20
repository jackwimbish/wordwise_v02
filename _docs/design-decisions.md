# Editor & Suggestions: Technical Design Document

This document outlines the final design decisions for the core functionality of the AI Writing Assistant, focusing on the text editor, suggestion generation, and user interaction logic.

---

## 1. Suggestion Fetching & Analysis Strategy

The primary goal is to provide real-time suggestions efficiently without incurring excessive costs or latency. To achieve this, we will use a **paragraph-level analysis model** with a **stateless backend**.

### 1.1. Paragraph-Level Analysis

Instead of sending the entire document on every change, the frontend will be responsible for identifying which paragraphs have been edited and sending only those for analysis.

* **Rationale:** This approach was chosen over whole-document analysis and backend-diffing models because it drastically reduces payload size, minimizes LLM processing costs, and allows for a simpler, more scalable stateless backend architecture.

### 1.2. Frontend Change Detection Algorithm ("Dirty" Paragraphs)

1. **Paragraph IDs:** The frontend (TipTap) will assign a unique, persistent UUID to every paragraph node in the document. This ID is stored as a node attribute.

2. **Content Hashing:** The frontend will maintain a map of `paragraph_id -> content_hash`.

3. **On Update:** On every document change (debounced), the frontend will iterate through all paragraphs. For any paragraph where the hash of its current text content does not match the stored hash, it is marked as "dirty."

4. **API Payload:** Only the dirty paragraphs are collected and sent to the backend.

### 1.3. Positional Offset Calculation Algorithm

To ensure highlights appear in the correct place, the frontend and backend will collaborate.

1. **Frontend Provides Context:** When sending dirty paragraphs to the backend, the frontend will calculate and include the `base_offset` for each paragraph (its starting character position relative to the beginning of the entire document).

2. **Backend Calculates Final Position:** The LLM will return suggestions with offsets relative to the start of the paragraph text (`relative_start`, `relative_end`). The FastAPI backend will then calculate the final global position:

   * `global_start = paragraph.base_offset + relative_start`

   * `global_end = paragraph.base_offset + relative_end`
     The backend returns these final global offsets to the frontend.

---

## 2. Suggestion Interaction Logic

### 2.1. Suggestion Dismissal ("Memory")

Dismissed suggestions will not reappear for the same user in the same document. This is handled by a backend filtering system.

1. **Stable Suggestion Fingerprint:** A suggestion is uniquely identified by a stable `dismissal_identifier`.

   * **Algorithm:** The identifier is a string created by concatenating the flagged text with a machine-readable rule ID from the LLM: `f"{original_text}|{rule_id}"`. Example: `"Its|grammar:its_vs_its"`.

   * **Rationale:** This is highly robust and is not affected by changes in the LLM's human-readable explanation (`message`).

2. **Dismissal Flow:**

   * User clicks "Dismiss" on the frontend.

   * The frontend calls a `POST /api/v1/suggestions/dismiss` endpoint, sending the `document_id`, `original_text`, and `rule_id`.

   * The backend constructs the `dismissal_identifier` and saves it to the `dismissed_suggestions` table in Supabase.

3. **Filtering Flow:**

   * When the frontend requests new suggestions, the backend first queries the `dismissed_suggestions` table to get a list of all identifiers the user has blocked for that document.

   * After receiving fresh suggestions from the LLM, the backend filters this list, removing any suggestions whose identifier matches one in the blocklist.

   * Only the filtered list is sent back to the frontend.

### 2.2. "Accept Suggestion" Flow

This action is handled entirely on the frontend to provide a seamless user experience.

* **Algorithm:**

  1. User clicks "Accept" on a suggestion.

  2. The frontend creates a TipTap "transaction" that replaces the text range of the original suggestion with the `suggestion_text`.

  3. This transaction is applied to the editor state.

  4. This edit automatically triggers the highlight invalidation logic (see below), causing the accepted suggestion's highlight to disappear.

---

## 3. Editor Highlight Management (Frontend Logic)

The frontend is solely responsible for maintaining the correct position of highlights between API calls.

### 3.1. Paragraph ID Stability

The unique IDs assigned to paragraphs must be managed through edits.

* **Split:** When a paragraph is split (user presses `Enter`), the first part **retains the original ID**. The newly created second part gets a **brand new UUID**.

* **Merge:** When paragraph B is merged into paragraph A (user presses `Backspace` at the start of B), paragraph A **retains its original ID**. Paragraph B and its ID are destroyed.

* **Deletion:** When a paragraph is deleted, its ID is destroyed.

### 3.2. Real-time Highlight Transformation

* **Mechanism:** TipTap "Decorations" are used to render the highlights.

* **Algorithm (`onTransaction`):**

  1. For every change transaction in the editor, iterate through the list of suggestions currently held in the local state.

  2. Use the transaction's `mapping` object (`transaction.mapping.map(position)`) to calculate the new start and end positions for each suggestion.

  3. **Invalidation Check:** Check if the user's edit occurred *within* the suggestion's range (e.g., by checking deleted ranges in the transaction). If it did, the suggestion is invalid.

  4. **Update State:** Update the local suggestion state with the new list, which will contain suggestions with their transformed positions and have invalid suggestions removed. This triggers a re-render of the decorations.

---

## 4. Edge Case & Error Handling

* **LLM Failures:** The FastAPI backend will wrap all LLM calls in a `try...except` block. On failure (timeout, malformed JSON, etc.), the error will be logged to Sentry, and an empty list of suggestions will be returned for the affected paragraph(s).

* **Long Paragraphs:** The backend will enforce a maximum character limit on paragraphs sent for analysis. If a paragraph exceeds the limit, it will be rejected, and an error/message will be sent to the frontend.

* **Payload Abuse:** The backend API will enforce a limit on the number of paragraphs that can be processed in a single request to prevent denial-of-service attacks.
