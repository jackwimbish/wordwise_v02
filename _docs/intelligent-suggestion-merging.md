Technical Design: Intelligent Suggestion Merging Algorithm
This document provides a detailed technical specification for handling the state of suggestions when new data is received from the backend. Its purpose is to solve the problem of a non-deterministic LLM occasionally "missing" a still-valid suggestion during a re-analysis of an edited paragraph.

1. The Problem Statement
When a user edits a paragraph, we send that "dirty" paragraph to the backend for re-analysis. The LLM processes the text and returns a new list of suggestions. However, due to the probabilistic nature of LLMs, this new list might not include a suggestion that it had previously identified, even if the text related to that old suggestion remains unchanged.

A naive approach of simply replacing all old suggestions for that paragraph with the new list would cause valid suggestions to seemingly "flicker" in and out of existence, leading to a poor and confusing user experience.

2. The Solution: State-Driven Merge & Validation
The solution is to treat the existing frontend suggestion state as a "cache" of known-good suggestions. When a new list arrives from the API, we perform an intelligent merge operation that combines the new analysis with the "memory" of what was previously valid.

A suggestion is only ever removed if one of two conditions is met:

The user's edits have physically altered the text that the suggestion applies to.

A new, definitive analysis from the LLM confirms the suggestion is no longer relevant (which is implicitly handled by it not being returned). Our merge logic preserves the suggestion if the LLM simply "forgets" it.

3. Core Frontend State Requirements
The main editor component must maintain a master list of all current suggestions for the document. Each suggestion object must contain at least the following properties:

interface Suggestion {
  id: string; // A unique ID for this specific suggestion instance
  paragraphId: string; // The ID of the paragraph this suggestion belongs to
  rule_id: string; // The stable, machine-readable rule ID from the LLM
  original_text: string; // The text that was flagged
  start: number; // The current global start offset
  end: number; // The current global end offset
  // ...other properties like message, suggestion_text
}

A stable key for each unique suggestion type within a paragraph is critical. We will construct it on-the-fly for comparisons: original_text|rule_id.

4. The Merge Algorithm: Step-by-Step
This algorithm executes when the API response for dirty paragraphs is successfully received.

Inputs:

currentSuggestions: The master list of all suggestion objects from the component's state.

apiResponse: The data from the backend, mapping paragraph_id to an array of new suggestions. Example: { "p_uuid_1": [...], "p_uuid_2": [...] }.

Algorithm Steps:

Isolate Paragraphs for Update:

Get the list of paragraph IDs that were just analyzed from the keys of the apiResponse object (const updatedParagraphIds = Object.keys(apiResponse)).

Preserve Unchanged Suggestions:

Create a new list, finalSuggestions, by filtering currentSuggestions.

Keep all suggestions where the paragraphId is NOT in the updatedParagraphIds list. This list now contains all suggestions from paragraphs that were not part of this API call.

Perform Intelligent Merge for Each Updated Paragraph:

Iterate through each paragraphId in updatedParagraphIds.

For each paragraphId:

a. Get Suggestion Lists:

oldSuggestions: Filter currentSuggestions to get the list of suggestions previously associated with this paragraphId.

newSuggestions: Get the list of suggestions for this paragraphId from the apiResponse.

b. Create a Lookup for New Suggestions: Create a Set of the stable keys (original_text|rule_id) from the newSuggestions list. This provides an efficient O(1) lookup to check for existence.
