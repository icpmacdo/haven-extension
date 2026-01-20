# Havelock Orality Analyzer Build Order

## Overview

The extension has minimal internal dependencies. Build order is primarily about getting a working end-to-end flow, then refining each piece.

---

## Build Sequence

```
Step 1: Manifest + Skeleton
    ↓
Step 2: Background Service Worker (API wrapper)
    ↓
Step 3: Popup UI (static states)
    ↓
Step 4: Text Extraction (content script logic)
    ↓
Step 5: Integration (wire everything together)
    ↓
Step 6: Polish (error states, edge cases, styling)
```

---

## Step 1: Manifest + Skeleton

**What:** Create `manifest.json` and empty file structure

**Why first:** Everything depends on a valid manifest. Chrome won't load without it.

**Deliverables:**
- `manifest.json` with correct MV3 structure
- Empty `popup/popup.html`, `popup/popup.js`, `popup/popup.css`
- Empty `background/background.js`
- Placeholder icons (can be simple colored squares)

**Spec sections:** [Stack](stack.md) → File Structure, Permissions

**Status:** ✅ Implemented (pending manual verification)

---

## Step 2: Background Service Worker

**What:** Implement the API fetch wrapper in `background.js`

**Why second:** This is the core logic. Once it works, we can test with hardcoded text before building extraction.

**Deliverables:**
- Message listener for `{ type: 'analyze', text, include_chunks }`
- Fetch to Havelock API with timeout (AbortController)
- Single retry on network error
- Returns `{ success, data }` or `{ success: false, error }`
- AbortController tracking for cancellation

**Spec sections:** [Extension](extension.md) → API Integration, Message Contract

**Status:** ✅ Implemented (pending manual verification)

---

## Step 3: Popup UI (Static States)

**What:** Build popup HTML/CSS with all visual states

**Why third:** Can develop UI independently, test with mock data.

**Deliverables:**
- `popup.html` layout
- `popup.css` styling
- Four states rendered (can toggle manually for testing):
  - Idle: "Click Analyze to score this page"
  - Loading: spinner + "Analyzing..."
  - Success: score, mode badge, description, stats
  - Error: message + retry button
- Score label mapping (0.65 → "Mixed")
- Warning callout styling

**Spec sections:** [Extension](extension.md) → User Interface, Scoring Labels

**Status:** ✅ Implemented (pending manual verification)

---

## Step 4: Text Extraction

**What:** Implement text extraction logic that runs in page context

**Why fourth:** Needs to be injected via `executeScript`. Can test independently.

**Deliverables:**
- Extraction function that returns `{ text, source, wordCount, truncated }`
- Selection detection
- Readability.js integration (bundle the library)
- innerText fallback
- Truncation logic (MAX_CHARS)
- Word count calculation

**Spec sections:** [Extension](extension.md) → Text Extraction

**Status:** ✅ Implemented (pending manual verification)

---

## Step 5: Integration

**What:** Wire popup → extraction → background → API → render

**Why fifth:** All pieces exist, now connect them.

**Deliverables:**
- Popup "Analyze" button triggers `executeScript` for extraction
- Popup sends extracted text to background via `sendMessage`
- Popup receives response and renders appropriate state
- Button disabled during loading
- include_chunks auto-enabled based on thresholds

**Spec sections:** [Extension](extension.md) → Architecture, Concurrency

**Status:** ✅ Implemented (pending manual verification)

---

## Step 6: Polish

**What:** Handle edge cases, improve UX, finalize styling

**Why last:** Core functionality must work first.

**Deliverables:**
- Restricted page detection (chrome://, extensions, etc.)
- Short text warnings
- Truncation notes
- Abort previous request on new analyze
- Final visual polish
- Test on various page types

**Spec sections:** [Extension](extension.md) → Error Handling, Edge Cases

**Status:** ✅ Implemented (pending manual verification)

---

## Step 7: v0.2/v0.3 Enhancements

**What:** Add context menu, selection-only mode, result caching, and chunk breakdown UI

**Why last:** Builds on the MVP foundation without changing core flow

**Deliverables:**
- Context menu "Analyze selection"
- Selection-only toggle in popup
- Session caching per URL + text hash
- Chunk breakdown chart + list (chunk_scores)

**Spec sections:** [Extension](extension.md) → Requirements, User Interface

**Status:** ✅ Implemented (pending manual verification)

---

## Dependency Graph

```
manifest.json
     │
     ├──► background.js (no deps except manifest)
     │
     ├──► popup.html/js/css (no deps except manifest)
     │
     └──► extraction logic
              │
              └──► Readability.js (bundled)

Integration connects: popup ←→ extraction ←→ background ←→ API
```

All components can be developed in parallel after Step 1, but integration (Step 5) requires all pieces.

---

## Testing Checkpoints

| After Step | Test |
|------------|------|
| 1 | Extension loads in Chrome without errors |
| 2 | Console: `chrome.runtime.sendMessage({type:'analyze', text:'test', include_chunks:false})` returns API response |
| 3 | Popup opens, shows all states when toggled manually |
| 4 | `executeScript` returns extracted text from test pages |
| 5 | Full flow: click Analyze → see real results |
| 6 | Edge cases handled gracefully |
| 7 | Context menu, selection-only, chunk breakdown, caching verified |
