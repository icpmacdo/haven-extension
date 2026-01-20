# Havelock Orality Analyzer - Project Guide for Claude

## What is Havelock Orality Analyzer?

A Chrome extension that scores the "orality" of web text using the Havelock API. Users click Analyze to get a score from 0 (highly literate) to 1 (highly oral), along with interpretation and metadata. It extracts text from selections, articles (via Readability.js), or falls back to page text.

---

## Spec Organization

Specs live in `docs/spec/`. They are split into **shared specs** (apply across features) and **feature specs** (specific to one feature). See `docs/spec-strategy.md` for the methodology.

```
docs/spec/
├── index.md          # Start here - overview and links to all specs
├── build-order.md    # Implementation order and dependencies
├── stack.md          # Tech stack: Chrome MV3, Readability.js, etc.
└── extension.md      # Main feature spec: popup, extraction, API integration
```

**When working on a feature:**
1. Read the feature spec (`extension.md`)
2. Check the "Related Specs" table at the top - it points to shared specs
3. Consult `stack.md` for tech choices and constraints

**Spec status:**
- ✅ Complete - Spec is written and approved
- 🔲 Pending - Placeholder with structure, needs content

---

## Key Documentation

| File | Purpose |
|------|---------|
| `docs/spec/index.md` | Spec overview - start here for specs |
| `docs/spec/stack.md` | Complete tech stack reference |
| `docs/spec/extension.md` | Main extension feature spec |
| `docs/spec-strategy.md` | Reusable spec strategy (methodology reference) |

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Platform | Chrome Extension (Manifest V3) |
| Text Extraction | @mozilla/readability |
| API | Havelock Orality API (Modal) |
| UI | Vanilla HTML/CSS/JS (popup) |

See `docs/spec/stack.md` for full details.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Popup (popup.html/js)                                  │
│  - UI rendering (idle/loading/success/error)            │
│  - Triggers text extraction via executeScript           │
│  - Sends text to background, displays results           │
└────────────────────────┬────────────────────────────────┘
                         │ chrome.runtime.sendMessage
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Background Service Worker (background.js)              │
│  - Receives analyze(text, include_chunks) messages      │
│  - Fetches from Havelock API (timeout + retry)          │
│  - Returns JSON response or error                       │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Havelock API (external)                                │
│  POST / → orality_score, interpretation, etc.           │
└─────────────────────────────────────────────────────────┘
```

---

## External Services

- **Havelock Orality API** - Analyzes text orality (0-1 score). No auth required. Endpoint: `https://jnathan--havelock-api-havelockapi-analyze.modal.run`

---

## Important Constraints

- **MV3 only** - No Manifest V2 patterns (background pages, etc.)
- **No persistent storage MVP** - No chrome.storage usage in v0.1
- **Manual trigger only** - No automatic/background analysis
- **Privacy** - Text sent only on user action; nothing stored

---

## Configuration Constants (MVP)

```javascript
const CONFIG = {
  MIN_WORDS_SELECTION: 15,      // Below: show "short text" note
  MIN_WORDS_ARTICLE: 200,       // Below: fallback to innerText
  MAX_CHARS: 120_000,           // Truncate and note
  API_TIMEOUT_MS: 20_000,
  INCLUDE_CHUNKS_WORD_THRESHOLD: 1200,
  INCLUDE_CHUNKS_CHAR_THRESHOLD: 8000,
  API_URL: 'https://jnathan--havelock-api-havelockapi-analyze.modal.run'
};
```

---

## Message Contract

### AnalyzeRequest (popup → background)
```typescript
{
  type: 'analyze',
  text: string,
  include_chunks: boolean,
  url?: string
}
```

### AnalyzeResponse (background → popup)
```typescript
{
  success: true,
  data: {
    orality_score: number,      // 0-1
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

### AnalyzeError (background → popup)
```typescript
{
  success: false,
  error: {
    type: 'network' | 'api' | 'extraction' | 'aborted',
    message: string,
    status?: number             // HTTP status if api error
  }
}
```

---

## Current State

- **Specs:** ✅ Complete
- **Implementation:** ✅ Implemented through v0.3 (pending manual verification)

---

## Working with This Project

**Default mode is discussion, not implementation.** Spec first, code second.

1. **Before coding:** Check spec status in `docs/spec/index.md`
2. **For stack decisions:** See `docs/spec/stack.md`
3. **For implementation order:** See `docs/spec/build-order.md`

### Before Suggesting Implementation

Don't suggest implementing a feature or section until:

1. **No unresolved TODOs** in that section
2. **No open questions** - they've been discussed and answered
3. **User has approved** - they've reviewed and agreed
4. **Status is ✅ Complete** - explicitly marked
5. **Dependencies ready** - what this depends on is implemented or well-defined

---

## Keep Docs in Sync

**IMPORTANT:** Always update documentation as you work.

- When you implement something, update the relevant spec to reflect reality
- When you make architecture decisions, document them
- Mark spec sections as ✅ Complete when implemented and verified

The user may start new sessions and relies on docs being accurate.
