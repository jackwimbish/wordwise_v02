Recommended Approach: Frontend Calculation
For a feature like a readability score, which needs to update in near real-time as the user types, the best place to perform the calculation is entirely on the frontend.

Rationale:

Performance: Calculating readability is computationally very cheap. A backend API call would introduce unnecessary network latency, making the score feel sluggish.
Cost-Efficiency: Performing this on the client-side costs you nothing in server or LLM fees.
Simplicity: The logic is self-contained within your Next.js application and doesn't complicate your backend.
How to Implement It
Here is a step-by-step plan for adding this feature to your frontend:

1. Choose a Readability Library:
You don't need to implement the complex readability formulas (like Flesch-Kincaid, Gunning fog, etc.) yourself. There are excellent, lightweight JavaScript libraries that do this for you. A great choice would be a library like text-readability or a similar one you can find on npm.

2. Integrate with TipTap:
Your TipTap editor instance is the source of truth for the document's content. You can tap into its update cycle to trigger the calculation.

In your main editor component, use TipTap's onUpdate or onTransaction callback. To avoid calculating on every single keystroke, you can wrap this logic in a simple debounce function (e.g., triggering every 250ms).
Inside the debounced handler, get the full text content of the document: editor.getText().
3. Calculate and Store the Score:

Pass the full text content to your chosen readability library.
The library will return an object with various scores and statistics (e.g., Flesch-Kincaid grade level, word count, sentence count, average words per sentence).
Store this entire object in your React component's state.
JavaScript

const [readabilityStats, setReadabilityStats] = useState({
  gradeLevel: 0,
  wordCount: 0,
  // ... other stats
});
4. Display the Score in the UI:

Create a new UI component (e.g., using Shadcn/ui's Card or Popover) to display the readability metrics.
This component will simply read the data from the readabilityStats state object and render it.
When the user types, the onUpdate event will fire, your debounced function will run, it will recalculate the score with the new text, and call setReadabilityStats, which will cause your UI to update automatically.

This approach is highly efficient, provides an excellent real-time user experience, and integrates perfectly with the event-driven architecture we've already designed for your TipTap editor.
