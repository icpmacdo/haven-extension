// Havelock Orality Analyzer - Background Service Worker

const CONFIG = {
  API_URL: 'https://jnathan--havelock-api-havelockapi-analyze.modal.run',
  API_TIMEOUT_MS: 20_000,
  CACHE_TTL_MS: 6 * 60 * 60 * 1000,
  CACHE_MAX_ENTRIES: 50,
  SELECTION_REQUEST_TTL_MS: 2 * 60 * 1000
};

// Track active request for cancellation
let activeController = null;
const analysisCache = new Map();
let pendingSelectionRequest = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'analyze-selection',
      title: 'Analyze selection',
      contexts: ['selection']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'analyze-selection') {
    return;
  }

  if (!tab || tab.id == null) {
    return;
  }

  pendingSelectionRequest = {
    tabId: tab.id,
    url: tab.url || '',
    requestedAt: Date.now()
  };

  if (chrome.action && chrome.action.openPopup) {
    chrome.action.openPopup({ windowId: tab.windowId }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'analyze') {
    handleAnalyze(request.text, request.include_chunks, request.url)
      .then(sendResponse);
    return true; // Keep channel open for async response
  }
  if (request.type === 'getPendingSelection') {
    sendResponse(consumePendingSelection());
  }
});

async function handleAnalyze(text, includeChunks, url) {
  // Cancel any in-flight request
  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  const cacheKey = buildCacheKey(text, includeChunks, url);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return { success: true, data: cached, cached: true };
  }

  const controller = new AbortController();
  activeController = controller;
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    if (activeController !== controller) {
      return;
    }
    didTimeout = true;
    controller.abort();
  }, CONFIG.API_TIMEOUT_MS);

  try {
    const response = await fetchWithRetry(text, includeChunks, controller.signal);
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

async function fetchWithRetry(text, includeChunks, signal, retried = false) {
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, include_chunks: includeChunks }),
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
      return fetchWithRetry(text, includeChunks, signal, true);
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

function consumePendingSelection() {
  if (!pendingSelectionRequest) {
    return { pending: false };
  }

  const ageMs = Date.now() - pendingSelectionRequest.requestedAt;
  if (ageMs > CONFIG.SELECTION_REQUEST_TTL_MS) {
    pendingSelectionRequest = null;
    return { pending: false };
  }

  const { tabId, url } = pendingSelectionRequest;
  pendingSelectionRequest = null;
  return { pending: true, tabId, url };
}

function buildCacheKey(text, includeChunks, url) {
  const textHash = hashText(text || '');
  const baseUrl = url || 'unknown';
  const chunkSuffix = includeChunks ? 'chunks' : 'no-chunks';
  return `${baseUrl}::${chunkSuffix}::${textHash}`;
}

function getCachedResult(cacheKey) {
  const entry = analysisCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.cachedAt > CONFIG.CACHE_TTL_MS) {
    analysisCache.delete(cacheKey);
    return null;
  }
  return entry.data;
}

function setCachedResult(cacheKey, data) {
  analysisCache.set(cacheKey, { data, cachedAt: Date.now() });
  if (analysisCache.size > CONFIG.CACHE_MAX_ENTRIES) {
    const oldestKey = analysisCache.keys().next().value;
    analysisCache.delete(oldestKey);
  }
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

console.log('Havelock background service worker loaded');
