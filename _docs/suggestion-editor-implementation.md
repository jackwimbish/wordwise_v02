# Frontend Implementation Plan: AI Suggestions

This document outlines the step-by-step plan to implement the AI-powered suggestion feature into the existing document editor. Each milestone represents a distinct, testable piece of functionality.

---

### **Milestone 1: Static Suggestion Highlighting**

**Goal:** Prove that we can visually highlight arbitrary text ranges in the editor. This isolates the core TipTap rendering logic without involving any backend communication.

* **Tasks:**
    1.  **Create Custom TipTap Extension:** Create a new file (e.g., `/frontend/src/lib/editor/SuggestionExtension.ts`) for a custom TipTap extension. This extension will be responsible for rendering our suggestion highlights.
    2.  **Implement Decorations:** Inside the extension, use TipTap's `addProseMirrorPlugins` hook to create a `Plugin` that uses the Decoration API. Decorations are non-content-altering overlays perfect for highlighting.
    3.  **Hardcode Suggestions:** In your main TipTap editor component (e.g., `/frontend/src/components/editor/TiptapEditor.tsx`), create a hardcoded array of suggestion objects in your component's state. Each object should have `start` and `end` character offsets.
        ```javascript
        const [suggestions, setSuggestions] = useState([
          { id: 'test-1', start: 25, end: 32, message: 'Test Highlight 1' },
          { id: 'test-2', start: 50, end: 55, message: 'Test Highlight 2' }
        ]);
        ```
    4.  **Render Decorations:** Pass the `suggestions` array from your state into your TipTap editor and configure the custom extension to read this data. The extension will then create a `Decoration.inline()` for each suggestion, applying a specific CSS class (e.g., `suggestion-highlight`) to the text between the `start` and `end` offsets.

* **Backend Routes Needed:** None.

* **Success Criteria:** When the editor loads, the hardcoded text ranges are visibly highlighted (e.g., with a colored underline).

---

### **Milestone 2: Real-time Highlight Transformation**

**Goal:** Make the static highlights "stick" to the text as the user types, moves, and deletes content. This validates the core real-time user experience.

* **Tasks:**
    1.  **Implement `onTransaction`:** In your TipTap editor configuration, add the `onTransaction` callback. This function fires for every single change made to the document.
    2.  **Map Positions:** Inside `onTransaction`, if `transaction.docChanged` is true, iterate through your hardcoded `suggestions` from the component state. For each suggestion, use `transaction.mapping.map(suggestion.start)` and `transaction.mapping.map(suggestion.end)` to calculate the new positions of the highlight after the edit.
    3.  **Handle Invalidation:** After mapping the positions, check if the user's edit invalidated the suggestion. A suggestion is invalid if the user typed *inside* its range or deleted it. This can be checked by seeing if the text content at the new start/end positions has changed or by analyzing the transaction's deleted ranges.
    4.  **Update State:** Create a new array containing the transformed, still-valid suggestions. Use your state's setter function (e.g., `setSuggestions(newSuggestions)`) to update the component. This will trigger a re-render, and the decorations will appear in their new, correct positions.

* **Backend Routes Needed:** None.

* **Success Criteria:** Type and delete characters *before* a highlight; the highlight should move correctly with the text. Type *inside* a highlight; the highlight should disappear. This is a critical test.

---

### **Milestone 3: Live Data & Stale State Handling**

**Goal:** Replace the hardcoded data with real suggestions fetched from the backend, and correctly handle the race condition where a user types while an API request is in-flight.

* **Tasks:**
    1.  **Paragraph-Level Logic:** Implement the "dirty" paragraph tracking system. Assign unique IDs to paragraphs and use content hashing to detect which paragraphs have changed on each `onTransaction` event.
    2.  **Debounced API Call:** Create a debounced function that triggers after the user stops typing (~500ms). This function will gather all "dirty" paragraphs, including their `paragraph_id` and their `base_offset` (their starting position in the full document).
    3.  **Stale State Management:**
        * When the API call is sent, store a list of all user edits (`transactions`) that occur *while the request is in-flight*.
        * When the API response arrives (with now-stale positions), iterate through your stored transactions and use their mappings to transform the stale positions into the current, correct ones.
    4.  **State Update:** Merge the newly fetched, transformed, and validated suggestions into your main component state.

* **Backend Routes Needed:** `POST /api/v1/suggestions`
    * This endpoint must be fully functional. It needs to accept an array of paragraphs (with `paragraph_id`, `text`, `base_offset`), call the LLM, and return a list of suggestions with calculated **global** offsets.

* **Success Criteria:** Remove the hardcoded suggestions. When you type a sentence with an error, a highlight with a real suggestion from the LLM appears in the correct place, even if you type elsewhere in the document while the request is processing.

---

### **Milestone 4: Full User Interaction**

**Goal:** Allow users to accept or dismiss the suggestions, completing the feature loop.

* **Tasks:**
    1.  **Build Suggestion UI:** Use Shadcn/ui components (`Popover`, `Card`, `Button`) to create the UI that appears when a user clicks on a highlighted suggestion.
    2.  **Implement "Accept" Logic:** The "Accept" button will trigger a function that creates and applies a TipTap transaction, replacing the original text range with the suggested text.
    3.  **Implement "Dismiss" Logic:** The "Dismiss" button will call a new backend endpoint to record the user's choice and will also immediately remove the suggestion from the local component state so the UI updates instantly.

* **Backend Routes Needed:** `POST /api/v1/suggestions/dismiss`
    * This endpoint must be ready to receive a `dismissal_identifier` (`original_text|rule_id`) and save it to the `dismissed_suggestions` table. The main suggestions endpoint must also be updated to filter out these dismissals.

* **Success Criteria:** The full user interaction is complete. A user can see, accept, and dismiss suggestions. Dismissed suggestions do not reappear on subsequent analyses.

