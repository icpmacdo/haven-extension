# Havelock Orality Analyzer Specification

**Havelock Orality Analyzer** - One-click orality scoring for web text

A Chrome extension that analyzes text on any webpage and returns an orality score (0 = highly literate, 1 = highly oral) using the Havelock API. Extracts text intelligently from selections, articles, or full pages.

---

## Spec Components

### Planning
| Document | Status | Description |
|----------|--------|-------------|
| [Build Order](build-order.md) | ✅ Complete | Implementation order and dependencies |

### Shared Specs
| Document | Status | Description |
|----------|--------|-------------|
| [Stack](stack.md) | ✅ Complete | Chrome MV3, Readability.js, API integration |

### Feature Specs
| Document | Status | Description |
|----------|--------|-------------|
| [Extension](extension.md) | ✅ Complete | Popup UI, text extraction, API calls, error handling |

---

## Project Scope

### Phase 1: MVP (v0.1) ✅ Implemented (pending manual verification)
- ✅ Toolbar popup with Analyze button
- ✅ Text extraction: selection → Readability article → innerText fallback
- ✅ API integration with Havelock endpoint
- ✅ Display score, interpretation, word count, chunks analyzed
- ✅ Loading, success, and error states
- ✅ Warnings for short/truncated text

### Phase 2: v0.2 ✅ Implemented (pending manual verification)
- ✅ Context menu "Analyze selection"
- ✅ "Selection only" toggle
- ✅ Basic caching per URL+hash (session memory)

### Phase 3: v0.3
- ✅ Chunk breakdown UI (list + mini histogram)
- 🔲 "Analyze readability vs full page" selector
- 🔲 Export result JSON

### Future
- Auto-analysis on page load (opt-in)
- Persisted history
- In-page highlighting by chunk score

---

## Target Users

Anyone who wants to understand the orality/literacy characteristics of web content:
- Researchers studying communication styles
- Writers analyzing their own work
- Educators examining content readability
- Content analysts

---

## External References

- **Havelock API:** `https://jnathan--havelock-api-havelockapi-analyze.modal.run`
- **Readability.js:** https://github.com/mozilla/readability
- **Chrome Extensions MV3:** https://developer.chrome.com/docs/extensions/mv3/
