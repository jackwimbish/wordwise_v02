# Feature Design Document: Rewrite for Target Length

This document outlines the user experience and technical implementation for a new feature that allows users to rewrite their document to meet specific word or character count goals.

---

## 1. Feature Overview

**Goal:** To provide users with an AI-powered tool that can intelligently shorten or lengthen their text on a paragraph-by-paragraph basis, helping them meet common writing constraints (e.g., essays, reports, social media posts).

**Core Value:**
* **Actionable Feedback:** Instead of just telling a user their text is "too long," the feature provides concrete, rewritten suggestions.
* **User Control:** The paragraph-level approach ensures the user maintains full control over their document, accepting only the changes they approve.
* **Iterative Process:** A "Retry" option allows users to ask the AI for alternative rewrites if the first suggestion isn't suitable.

---

## 2. User Experience (UX) Flow

The feature is designed to be a user-initiated process presented in a clean, non-intrusive side panel.

1.  **Initiation:**
    * The user clicks a "Rewrite Tools" or "Length Goals" button in the main editor toolbar.
    * A small form (`Popover` or `DropdownMenu`) appears, asking for the rewrite parameters:
        * **Target:** A number input (e.g., `500`).
        * **Unit:** A select dropdown (`Words` or `Characters`).
        * **Mode:** A toggle (`Shorten` or `Lengthen`).
    * The user clicks an "Analyze Document" button to start the process.

2.  **Suggestion Display:**
    * A side panel (`Sheet` component) slides out from the side of the editor. This keeps the main writing space uncluttered.
    * The panel displays a list of "Suggestion Cards," one for each paragraph the AI has a rewrite for.

3.  **The Suggestion Card:**
    * Each card is a self-contained suggestion unit.
    * **Header:** Displays the context, e.g., "Paragraph 3: Shorten from 85 to ~60 words."
    * **Diff View:** Presents a clear, visual comparison of the original text and the AI-rewritten version. Deleted text is highlighted in red, and added text is highlighted in green. (A library like `react-diff-viewer` can be used for this).
    * **Action Buttons:**
        * **`Accept`**: Applies the change to the editor.
        * **`Retry`**: Asks the AI for a different version of the rewrite for this paragraph.
        * **`Dismiss` (or 'X' icon)**: Closes the suggestion card.

4.  **Completion:**
    * When the user accepts a suggestion, the corresponding paragraph in the main editor instantly updates, and the card in the side panel is removed.
    * The user can close the side panel at any time to return to normal editing.

---

## 3. Technical Implementation Plan

This feature requires a new, dedicated backend endpoint and specific frontend components. It does not interfere with the real-time grammar suggestion system.

### 3.1. Backend (FastAPI)

#### **A. Main Rewrite Endpoint**

* **Route:** `POST /api/v1/rewrite/length`
* **Request Body Schema:**
    ```json
    {
      "document_id": "uuid",
      "full_text": "The entire document content...",
      "target_length": 500,
      "unit": "words",
      "mode": "shorten"
    }
    ```
* **Algorithm:**
    1.  Authenticate the user via JWT.
    2.  Calculate the current length of the `full_text` and the required change percentage.
    3.  Split the `full_text` into an array of paragraphs.
    4.  Iterate through the paragraphs. For each paragraph, construct a highly specific LLM prompt and call the AI service. These calls can be made concurrently using `asyncio.gather`.
    5.  **Crucial Prompt Engineering Examples:**
        * **Shorten Prompt:** `"You are a precise text editor. Your task is to shorten the following paragraph. The original length is 85 words. The target length is approximately 60 words. Preserve the core meaning, tone, and key details. Do not add any new information or commentary. Original Paragraph: '[insert original paragraph text here]'"`
        * **Lengthen Prompt:** `"You are an eloquent text editor. Your task is to expand the following paragraph. The original length is 40 words. The target length is approximately 70 words. Elaborate on the existing points with more descriptive detail, but do not introduce new topics or change the core meaning. Original Paragraph: '[insert original paragraph text here]'"`
    6.  Aggregate the results from the LLM.
    7.  Return a structured JSON array of suggestion objects to the frontend. Each object should include the `paragraph_id` (or index), the `original_text`, and the `rewritten_text`.

#### **B. "Retry" Endpoint**

* **Route:** `POST /api/v1/rewrite/retry`
* **Request Body Schema:**
    ```json
    {
      "original_paragraph": "The text of the paragraph to be rewritten...",
      "previous_suggestion": "The rewritten text the user rejected...",
      "target_length": 60,
      "unit": "words",
      "mode": "shorten"
    }
    ```
* **Algorithm:**
    1.  Construct a new prompt that explicitly asks for a different version.
    2.  **Prompt Example:** `"Rewrite the 'Original Paragraph' to be approximately 60 words. Provide a new version that is substantively different from the 'Previous Suggestion'. Original Paragraph: [...]. Previous Suggestion: [...]"`
    3.  Call the LLM and return the single new `rewritten_text`.

### 3.2. Frontend (Next.js)

1.  **UI Implementation:**
    * Build the initiation form (`Popover` with inputs).
    * Build the side panel (`Sheet`).
    * Build the `SuggestionCard` component, incorporating a diff viewer library to display the changes clearly.

2.  **API Logic:**
    * Implement the `fetch` call to `POST /api/v1/rewrite/length` when the user initiates the analysis. Store the returned array of suggestions in the component's state.
    * Implement the `fetch` call to `POST /api/v1/rewrite/retry` for the "Retry" button. When the response arrives, update the state for that specific suggestion card.

3.  **"Accept" Action Logic:**
    * This is the most critical frontend task.
    * Each suggestion card will know the `paragraph_id` of the paragraph it corresponds to.
    * When the user clicks "Accept", find the correct paragraph node in the TipTap editor state using its ID.
    * Create a TipTap **transaction** that replaces the content of that entire node with the `rewritten_text`.
    * Dispatch the transaction to the editor. This ensures a clean update without disrupting the user's cursor or focus.

