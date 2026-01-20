# Havelock Orality Analyzer Tech Stack

## Overview

Chrome Extension using Manifest V3. No backend server — the extension communicates directly with the external Havelock API. All code runs client-side in the browser.

---

## Stack Summary

| Layer | Technology | Notes |
|-------|------------|-------|
| **Platform** | Chrome Extension MV3 | Modern extension architecture |
| **Text Extraction** | @mozilla/readability | Battle-tested article extraction |
| **API** | Havelock Orality API | External service, no auth |
| **UI** | Vanilla HTML/CSS/JS | Simple popup, no framework needed |
| **Build** | None (MVP) | Direct file loading, no bundler |

---

## Chrome Extension Details

### Manifest V3

Using MV3 (not MV2) for Chrome Web Store compatibility and modern APIs.

Key MV3 patterns:
- **Service worker** instead of background page (no persistent state)
- **chrome.scripting.executeScript** instead of content scripts for on-demand extraction
- **host_permissions** for API access

### Permissions Required

```json
{
  "permissions": ["activeTab", "scripting", "contextMenus"],
  "host_permissions": [
    "https://jnathan--havelock-api-havelockapi-analyze.modal.run/*"
  ]
}
```

| Permission | Why |
|------------|-----|
| `activeTab` | Access current tab when user clicks extension |
| `scripting` | Run text extraction code in the page |
| `contextMenus` | Add right-click "Analyze selection" |
| `host_permissions` (API URL) | Allow fetch to Havelock API |

### File Structure (MVP)

```
haven-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── background/
│   └── background.js
├── lib/
│   └── Readability.js      # Bundled from @mozilla/readability
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── spec/
```

---

## Text Extraction

### @mozilla/readability

Bundled directly (no npm/build step for MVP). Source: https://github.com/mozilla/readability

Used for extracting article content from pages. Works on a cloned DOM to avoid modifying the page.

**Usage in content script context:**
```javascript
const documentClone = document.cloneNode(true);
const article = new Readability(documentClone).parse();
// article.textContent contains the extracted text
```

### Extraction Priority

1. **Selection** — `window.getSelection().toString().trim()`
2. **Readability article** — if selection empty, try article extraction
3. **Fallback** — `document.body.innerText` if Readability yields insufficient text

---

## External Services

### Havelock Orality API

**Base URL:** `https://jnathan--havelock-api-havelockapi-analyze.modal.run`

**Endpoint:** `POST /`

**Request:**
```json
{
  "text": "string (required)",
  "include_chunks": "boolean (optional)"
}
```

**Response:**
```json
{
  "orality_score": 0.65,
  "interpretation": {
    "mode": "Mixed",
    "description": "Text shows characteristics of both oral and literate traditions..."
  },
  "word_count": 1500,
  "chunks_analyzed": 12,
  "warning": "optional warning message"
}
```

**Characteristics:**
- No authentication required
- Cold start possible (Modal serverless) — hence 20s timeout
- No rate limiting documented

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  User clicks "Analyze" in popup                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Popup: chrome.scripting.executeScript                           │
│  - Runs extraction function in active tab                        │
│  - Returns: { text, source, wordCount, truncated }               │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Popup: chrome.runtime.sendMessage({ type: 'analyze', ... })     │
│  - Sends extracted text to background                            │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Background: cache lookup, fetch(API_URL, { method: 'POST' })    │
│  - Timeout: 20s via AbortController                              │
│  - Retry: 1x on network error (not 4xx/5xx)                      │
│  - Cache: URL + text hash (session memory)                       │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Background: return response to popup                            │
│  - { success: true, data: {...} } or                             │
│  - { success: false, error: {...} }                              │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Popup: render results or error                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Development Tools

| Tool | Purpose |
|------|---------|
| Chrome | Load unpacked extension for testing |
| Chrome DevTools | Debug popup and background worker |
| `chrome://extensions` | Extension management, reload |

No build tools, linters, or bundlers for MVP — just edit and reload.

---

## Future Considerations

- **Bundler:** If adding more dependencies, consider esbuild/rollup
- **TypeScript:** Could add for type safety in v0.2+
- **Storage:** `chrome.storage.local` for user preferences in v0.2
- **Context menus:** Implemented via `chrome.contextMenus` for right-click analyze
