# Havelock Orality Analyzer - Extension Specification

One-click orality scoring for web text via the Havelock API.

**Status:** ✅ Complete
**Priority:** 1 (MVP)

---

## Related Specs

| Spec | Relevance |
|------|-----------|
| [Stack](stack.md) | Chrome MV3 patterns, Readability.js, API details |
| [Build Order](build-order.md) | Implementation sequence |

---

## Overview

Users click "Analyze" in the extension popup to score the orality of text on the current page. The extension extracts text (from selection, article, or full page), sends it to the Havelock API, and displays the results.

**User stories:**
- "As a researcher, I want to quickly score an article's orality so I can categorize it for my study"
- "As a writer, I want to analyze my selected paragraph to see if it reads as oral or literate"
- "As a content analyst, I want to understand the communication style of a webpage"

---

## Requirements

### Must Have (MVP)
- Analyze button in popup
- Extract text: selection → Readability article → innerText fallback
- Call Havelock API with extracted text
- Display: orality_score, mode, description, word_count, chunks_analyzed
- Display warning if API returns one
- Loading state with disabled button
- Error state with retry option
- Handle restricted pages gracefully

### Should Have (MVP)
- Truncation note when text exceeds MAX_CHARS
- "Short text" note when below MIN_WORDS_SELECTION
- Auto-enable include_chunks for long text
- Cancel in-flight request when new one starts

### Implemented (v0.2/v0.3)
- Context menu "Analyze selection"
- Selection-only toggle
- Chunk breakdown display
- Result caching (session memory, adds "Cached result" note)

---

## Configuration

All thresholds hardcoded in a single CONFIG object (no settings UI for MVP).

```javascript
const CONFIG = {
  // Extraction thresholds
  MIN_WORDS_SELECTION: 15,        // Below: show "short text" note, still analyze
  MIN_WORDS_ARTICLE: 200,         // Below: fallback to innerText
  MAX_CHARS: 120_000,             // Truncate input, show note

  // API settings
  API_URL: 'https://jnathan--havelock-api-havelockapi-analyze.modal.run',
  API_TIMEOUT_MS: 20_000,

  // Chunking thresholds (either triggers include_chunks: true)
  INCLUDE_CHUNKS_WORD_THRESHOLD: 1200,
  INCLUDE_CHUNKS_CHAR_THRESHOLD: 8000,

  // Caching (background-only)
  CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  CACHE_MAX_ENTRIES: 50,
  SELECTION_REQUEST_TTL_MS: 2 * 60 * 1000
};
```

---

## User Interface

### Entry Point

Toolbar popup (click extension icon).

### Context Menu

Right-click selected text to trigger **Analyze selection**. This opens the popup,
enables selection-only mode, and runs analysis on the current selection.

### Popup States

The selection-only toggle is shown above the Analyze button and applies to all states.
Chunk breakdown appears in the success state when `chunk_scores` is returned.

#### 1. Idle State
```
┌─────────────────────────────────┐
│                                 │
│   Click Analyze to score        │
│   this page's orality           │
│                                 │
│        [ Analyze ]              │
│                                 │
│   Sends text to Havelock for    │
│   analysis. Nothing stored.     │
└─────────────────────────────────┘
```

#### 2. Loading State
```
┌─────────────────────────────────┐
│                                 │
│         ◌ Analyzing...          │
│                                 │
│        [ Analyze ]  (disabled)  │
│                                 │
└─────────────────────────────────┘
```

#### 3. Success State
```
┌─────────────────────────────────┐
│                                 │
│           0.65                  │  ← Large score (2-3 decimals)
│          Mixed                  │  ← Mode badge
│                                 │
│   Text shows characteristics    │  ← Description (from API)
│   of both oral and literate     │
│   traditions...                 │
│                                 │
│   ─────────────────────────     │
│   1,523 words · 12 chunks       │  ← Stats row
│                                 │
│   ⚠ Warning text if present     │  ← Optional warning callout
│                                 │
│        [ Analyze Again ]        │
└─────────────────────────────────┘
```

Success state also includes a chunk breakdown chart + list when `chunk_scores`
is returned by the API.

#### 4. Error State
```
┌─────────────────────────────────┐
│                                 │
│   ❌ Analysis failed            │
│                                 │
│   Request timed out. The API    │
│   may be cold-starting.         │
│                                 │
│        [ Retry ]                │
│                                 │
└─────────────────────────────────┘
```

### Scoring Labels

Map orality_score to display label:

| Score Range | Label |
|-------------|-------|
| 0.85 – 1.00 | Highly Oral |
| 0.65 – 0.85 | Oral |
| 0.45 – 0.65 | Mixed |
| 0.25 – 0.45 | Literate |
| 0.00 – 0.25 | Highly Literate |

```javascript
function getScoreLabel(score) {
  if (score >= 0.85) return 'Highly Oral';
  if (score >= 0.65) return 'Oral';
  if (score >= 0.45) return 'Mixed';
  if (score >= 0.25) return 'Literate';
  return 'Highly Literate';
}
```

---

## Text Extraction

### Priority Order

1. **Selection** — If user has text selected
2. **Readability article** — If no selection, extract article
3. **innerText fallback** — If Readability yields insufficient text

### Selection-Only Mode

When enabled, extraction only returns the current selection. If no selection
exists, return an empty result and show a "No text selected" error.

### Extraction Function

Runs in page context via `chrome.scripting.executeScript`:

```javascript
function extractText(selectionOnly) {
  // 1. Check selection
  const selection = normalize(window.getSelection().toString());
  if (selection) {
    const { text, truncated } = truncate(selection, CONFIG.MAX_CHARS);
    return {
      text,
      source: 'selection',
      wordCount: countWords(text),
      truncated
    };
  }

  if (selectionOnly) {
    return { text: '', source: 'selection', wordCount: 0, truncated: false, noSelection: true };
  }

  // 2. Try Readability
  const documentClone = document.cloneNode(true);
  const article = new Readability(documentClone).parse();

  if (article?.textContent) {
    const text = normalize(article.textContent);
    const wordCount = countWords(text);

    if (wordCount >= CONFIG.MIN_WORDS_ARTICLE) {
      const { text: truncatedText, truncated } = truncate(text, CONFIG.MAX_CHARS);
      return {
        text: truncatedText,
        source: 'article',
        wordCount: countWords(truncatedText),
        truncated
      };
    }
  }

  // 3. Fallback to innerText
  const text = normalize(document.body.innerText);
  const { text: truncatedText, truncated } = truncate(text, CONFIG.MAX_CHARS);
  return {
    text: truncatedText,
    source: 'fallback',
    wordCount: countWords(truncatedText),
    truncated
  };
}
```

### Normalization

- Collapse repeated whitespace: `/\s+/g` → single space (before truncation)
- Truncate at MAX_CHARS if exceeded

### Word Counting

```javascript
function countWords(text) {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}
```

---

## API Integration

### Request Flow

1. Popup extracts text via executeScript
2. Popup determines include_chunks based on thresholds
3. Popup sends to background: `{ type: 'analyze', text, include_chunks, url }`
4. Background checks cache (URL + text hash) and fetches from API on miss with timeout
5. Background returns result to popup

### Background Implementation

```javascript
// Track active request for cancellation
let activeController = null;
const analysisCache = new Map();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'analyze') {
    handleAnalyze(request.text, request.include_chunks, request.url)
      .then(sendResponse);
    return true; // Keep channel open for async response
  }
});

async function handleAnalyze(text, include_chunks, url) {
  // Cancel any in-flight request
  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  const cacheKey = buildCacheKey(text, include_chunks, url);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return { success: true, data: cached, cached: true };
  }

  const controller = new AbortController();
  activeController = controller;
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, CONFIG.API_TIMEOUT_MS);

  try {
    const response = await fetchWithRetry(text, include_chunks, controller.signal);
    clearTimeout(timeoutId);
    setCachedResult(cacheKey, response);
    return { success: true, data: response, cached: false };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: categorizeError(error, didTimeout)
    };
  } finally {
    if (activeController === controller) {
      activeController = null;
    }
  }
}

async function fetchWithRetry(text, include_chunks, signal, retried = false) {
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, include_chunks }),
      signal
    });

    if (!response.ok) {
      const error = new Error(`API error: ${response.status}`);
      error.status = response.status;
      error.type = 'api';
      throw error;
    }

    return await response.json();
  } catch (error) {
    // Retry once on network error (not abort, not API error)
    if (!retried && error.name !== 'AbortError' && !error.status) {
      return fetchWithRetry(text, include_chunks, signal, true);
    }
    throw error;
  }
}

function categorizeError(error, didTimeout) {
  if (error.name === 'AbortError') {
    return {
      type: 'aborted',
      message: didTimeout
        ? 'Request timed out. The API may be cold-starting.'
        : 'Request was cancelled'
    };
  }
  if (error.status) {
    return { type: 'api', message: `API returned ${error.status}`, status: error.status };
  }
  return { type: 'network', message: 'Network error. Check your connection.' };
}
```

### Include Chunks Logic

Auto-enable chunking for long text:

```javascript
function shouldIncludeChunks(text, wordCount) {
  return wordCount >= CONFIG.INCLUDE_CHUNKS_WORD_THRESHOLD ||
         text.length >= CONFIG.INCLUDE_CHUNKS_CHAR_THRESHOLD;
}
```

When `include_chunks` is true, the API returns `chunk_scores` (array of 0–1 values)
used to render the chunk breakdown chart + list.

---

## Architecture

### Message Contract

**AnalyzeRequest** (popup → background):
```typescript
{
  type: 'analyze',
  text: string,
  include_chunks: boolean,
  url?: string
}
```

**AnalyzeResponse** (background → popup, success):
```typescript
{
  success: true,
  data: {
    orality_score: number,
    interpretation: {
      mode: string,
      description: string
    },
    word_count: number,
    chunks_analyzed: number,
    warning?: string,
    chunk_scores?: number[]
  },
  cached?: boolean
}
```

**AnalyzeError** (background → popup, failure):
```typescript
{
  success: false,
  error: {
    type: 'network' | 'api' | 'extraction' | 'aborted',
    message: string,
    status?: number
  }
}
```

### Concurrency Handling

- **Button disabled** while analysis in progress
- **Clicks ignored** during loading
- **Previous request aborted** when new one starts (via AbortController)
- One active request per popup instance

---

## Error Handling

| Error Case | User Sees | Technical Handling |
|------------|-----------|-------------------|
| Restricted page (chrome://, extension pages) | "This page can't be analyzed due to browser restrictions." | executeScript throws; catch and show message |
| Network timeout | "Request timed out. The API may be cold-starting." | AbortController timeout triggers |
| Network error | "Network error. Check your connection." | fetch throws non-abort error |
| API 4xx/5xx | "API error (status code). Try again." | response.ok is false |
| Selection-only with no selection | "No text selected. Select text and try again." | selection-only extraction returns empty |
| Very short text | Success + note: "Text is very short (N words)" | wordCount < MIN_WORDS_SELECTION |
| Truncated input | Success + note: "Input truncated to 120k characters" | truncated flag from extraction |
| No text found | "No text found on this page." | extraction returns empty text |

### Restricted Page Detection

```javascript
function isRestrictedUrl(url) {
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('https://chrome.google.com/webstore') ||
         url.startsWith('https://chromewebstore.google.com') ||
         url.startsWith('about:') ||
         url.startsWith('edge://') ||
         url.startsWith('file://');
}
```

---

## Privacy

- **Data sent:** Only extracted text, only when user clicks Analyze
- **Data stored:** In-memory cache of results (URL + text hash), cleared on service worker restart
- **Disclosure:** Popup footer shows "Sends text to Havelock for analysis. Nothing is stored by this extension."

---

## Acceptance Criteria

- [ ] Extension loads without errors in Chrome
- [ ] Clicking Analyze on article page returns score and displays all fields
- [ ] Selecting text and clicking Analyze analyzes selection instead
- [ ] Long pages (>1200 words) show chunks_analyzed > 1
- [ ] Restricted pages (chrome://) show clear "cannot analyze" message
- [ ] Network timeout shows appropriate error + retry
- [ ] Multiple rapid clicks don't cause issues (button disabled, request aborted)
- [ ] Works in Chrome and Edge (Chromium MV3)
- [ ] Context menu "Analyze selection" triggers selection-only analysis
- [ ] Selection-only toggle analyzes selection and errors when none selected
- [ ] Chunk breakdown chart + list renders when chunk_scores is returned
- [ ] Result caching returns cached responses on repeated analyses

---

## Open Questions

None — all questions resolved.

---

## Resolved Questions

### Architecture
**Q:** Background service worker vs direct fetch from popup?
**A:** Background service worker. More reliable, easier to add context menu later, avoids popup-closing edge cases.

### Text Extraction
**Q:** Roll custom extraction or use Readability.js?
**A:** Bundle @mozilla/readability. Battle-tested, handles edge cases we'd miss.

### Configuration
**Q:** Expose thresholds to user?
**A:** No. Hardcode in CONFIG object for MVP. Can add settings UI later.

### Concurrency
**Q:** What happens on repeated Analyze clicks?
**A:** Button disabled during loading. New request aborts previous one.
