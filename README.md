# Haven Orality Analyzer

A Chrome extension that scores the "orality" of web text using the Havelock API.

## What It Does

Analyzes text and returns an orality score from 0 (highly literate) to 1 (highly oral), along with interpretation and metadata.

**Text extraction priority:**
1. Selected text on the page
2. Article content (via Readability.js)
3. Full page text (fallback)

## Installation

1. Clone this repo
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select the repo folder

## Usage

1. Navigate to any webpage with text content
2. Optionally select specific text to analyze
3. Click the Haven extension icon
4. Click "Analyze" to get the orality score

## Architecture

```
Popup (popup.html/js)
  ↓ chrome.runtime.sendMessage
Background Service Worker (background.js)
  ↓ fetch
Havelock API (external)
```

## Tech Stack

- Chrome Extension (Manifest V3)
- @mozilla/readability for article extraction
- Vanilla HTML/CSS/JS

## API

Uses the Havelock Orality API. No authentication required.

## Development

See `docs/spec/` for detailed specifications:
- `index.md` - Overview and links
- `extension.md` - Feature spec
- `stack.md` - Tech stack details
- `build-order.md` - Implementation order
