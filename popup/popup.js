// Havelock Orality Analyzer - Popup Script

const CONFIG = {
  MIN_WORDS_SELECTION: 15,
  MIN_WORDS_ARTICLE: 200,
  MAX_CHARS: 120_000,
  INCLUDE_CHUNKS_WORD_THRESHOLD: 1200,
  INCLUDE_CHUNKS_CHAR_THRESHOLD: 8000
};

// State management
let currentState = 'idle';
let isAnalyzing = false;

// DOM elements
const states = {
  idle: document.getElementById('state-idle'),
  loading: document.getElementById('state-loading'),
  success: document.getElementById('state-success'),
  error: document.getElementById('state-error')
};

const elements = {
  btnAnalyze: document.getElementById('btn-analyze'),
  btnAnalyzeAgain: document.getElementById('btn-analyze-again'),
  btnRetry: document.getElementById('btn-retry'),
  selectionToggle: document.getElementById('toggle-selection-only'),
  scoreValue: document.getElementById('score-value'),
  scoreLabel: document.getElementById('score-label'),
  description: document.getElementById('description'),
  statsWords: document.querySelector('#stats-words .stat-value'),
  statsChunks: document.querySelector('#stats-chunks .stat-value'),
  chunkBreakdown: document.getElementById('chunk-breakdown'),
  chunkCount: document.getElementById('chunk-count'),
  chunkChart: document.getElementById('chunk-chart'),
  chunkList: document.getElementById('chunk-list'),
  warningBox: document.getElementById('warning-box'),
  warningText: document.getElementById('warning-text'),
  notesBox: document.getElementById('notes-box'),
  notesText: document.getElementById('notes-text'),
  errorMessage: document.getElementById('error-message')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  elements.btnAnalyze.addEventListener('click', handleAnalyze);
  elements.btnAnalyzeAgain.addEventListener('click', handleAnalyze);
  elements.btnRetry.addEventListener('click', handleAnalyze);
  elements.selectionToggle.addEventListener('change', () => {
    if (currentState === 'loading') {
      elements.selectionToggle.checked = !elements.selectionToggle.checked;
    }
  });

  showState('idle');
  checkPendingSelection();
});

function showState(state) {
  currentState = state;
  Object.entries(states).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== state);
  });
  elements.selectionToggle.disabled = state === 'loading';
}

function getScoreLabel(score) {
  if (score >= 0.85) return { label: 'Highly Oral', class: 'highly-oral' };
  if (score >= 0.65) return { label: 'Oral', class: 'oral' };
  if (score >= 0.45) return { label: 'Mixed', class: 'mixed' };
  if (score >= 0.25) return { label: 'Literate', class: 'literate' };
  return { label: 'Highly Literate', class: 'highly-literate' };
}

function formatNumber(num) {
  return num.toLocaleString();
}

function shouldIncludeChunks(text, wordCount) {
  return wordCount >= CONFIG.INCLUDE_CHUNKS_WORD_THRESHOLD ||
         text.length >= CONFIG.INCLUDE_CHUNKS_CHAR_THRESHOLD;
}

function renderSuccess(data, notes = []) {
  const { orality_score, interpretation, word_count, chunks_analyzed, warning, chunk_scores } = data;
  const { label, class: labelClass } = getScoreLabel(orality_score);

  // Score and label
  elements.scoreValue.textContent = orality_score.toFixed(2);
  elements.scoreLabel.textContent = label;
  elements.scoreLabel.className = 'score-label ' + labelClass;

  // Description
  elements.description.textContent = interpretation?.description || '';

  // Stats
  elements.statsWords.textContent = formatNumber(word_count);
  elements.statsChunks.textContent = formatNumber(chunks_analyzed);

  renderChunkBreakdown(chunk_scores, chunks_analyzed);

  // Warning from API
  if (warning) {
    elements.warningText.textContent = warning;
    elements.warningBox.classList.remove('hidden');
  } else {
    elements.warningBox.classList.add('hidden');
  }

  // Notes (truncation, short text, etc.)
  if (notes.length > 0) {
    elements.notesText.textContent = notes.join(' · ');
    elements.notesBox.classList.remove('hidden');
  } else {
    elements.notesBox.classList.add('hidden');
  }

  showState('success');
}

function renderError(error) {
  elements.errorMessage.textContent = error.message || 'An unexpected error occurred.';
  showState('error');
}

async function handleAnalyze(options = {}) {
  if (isAnalyzing) return;

  isAnalyzing = true;
  showState('loading');

  try {
    const selectionOnly = options.selectionOnlyOverride !== undefined
      ? options.selectionOnlyOverride
      : elements.selectionToggle.checked;

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw { type: 'extraction', message: 'No active tab found.' };
    }

    if (options.expectedTabId && tab.id !== options.expectedTabId) {
      throw { type: 'extraction', message: 'Selection request expired. Select text and try again.' };
    }

    // Check for restricted URLs
    if (isRestrictedUrl(tab.url)) {
      throw { type: 'extraction', message: "This page can't be analyzed due to browser restrictions." };
    }

    // Extract text from page
    const extraction = await extractTextFromTab(tab.id, selectionOnly);

    if (selectionOnly && extraction?.noSelection) {
      throw { type: 'extraction', message: 'No text selected. Select text and try again.' };
    }

    if (!extraction || !extraction.text || extraction.text.trim().length === 0) {
      throw { type: 'extraction', message: 'No text found on this page.' };
    }

    // Build notes array
    const notes = [];
    if (extraction.truncated) {
      notes.push('Input truncated to 120k characters');
    }
    if (extraction.wordCount < CONFIG.MIN_WORDS_SELECTION) {
      notes.push(`Short text (${extraction.wordCount} words)`);
    }

    // Determine if we should include chunks
    const includeChunks = shouldIncludeChunks(extraction.text, extraction.wordCount);

    // Send to background for API call
    const response = await chrome.runtime.sendMessage({
      type: 'analyze',
      text: extraction.text,
      include_chunks: includeChunks,
      url: tab.url
    });

    if (response.success) {
      if (response.cached) {
        notes.push('Cached result');
      }
      renderSuccess(response.data, notes);
    } else {
      renderError(response.error);
    }
  } catch (error) {
    renderError(error);
  } finally {
    isAnalyzing = false;
  }
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('https://chrome.google.com/webstore') ||
         url.startsWith('https://chromewebstore.google.com') ||
         url.startsWith('about:') ||
         url.startsWith('edge://') ||
         url.startsWith('file://');
}

async function extractTextFromTab(tabId, selectionOnly) {
  try {
    if (!selectionOnly) {
      // First, inject Readability.js into the page
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['lib/Readability.js']
      });
    }

    // Then run the extraction function
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractTextFromPage,
      args: [CONFIG.MIN_WORDS_ARTICLE, CONFIG.MAX_CHARS, selectionOnly]
    });

    return results[0]?.result;
  } catch (error) {
    console.error('Extraction failed:', error);
    throw { type: 'extraction', message: "This page can't be analyzed due to browser restrictions." };
  }
}

// This function runs in the page context
function extractTextFromPage(minWordsArticle, maxChars, selectionOnly) {
  function countWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  function normalize(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function truncate(text, limit) {
    if (text.length <= limit) return { text, truncated: false };
    return { text: text.slice(0, limit), truncated: true };
  }

  // 1. Check selection first
  const selection = normalize(window.getSelection().toString() || '');
  if (selection) {
    const { text, truncated } = truncate(selection, maxChars);
    return {
      text,
      source: 'selection',
      wordCount: countWords(text),
      truncated
    };
  }

  if (selectionOnly) {
    return {
      text: '',
      source: 'selection',
      wordCount: 0,
      truncated: false,
      noSelection: true
    };
  }

  // 2. Try Readability extraction
  if (typeof Readability !== 'undefined') {
    try {
      const documentClone = document.cloneNode(true);
      const article = new Readability(documentClone).parse();

      if (article && article.textContent) {
        const articleText = normalize(article.textContent);
        const wordCount = countWords(articleText);

        if (wordCount >= minWordsArticle) {
          const { text, truncated } = truncate(articleText, maxChars);
          return {
            text,
            source: 'article',
            wordCount: countWords(text),
            truncated
          };
        }
      }
    } catch (e) {
      console.warn('Readability extraction failed:', e);
    }
  }

  // 3. Fallback to innerText
  const bodyText = normalize(document.body ? document.body.innerText : '');
  const { text, truncated } = truncate(bodyText, maxChars);

  return {
    text,
    source: 'fallback',
    wordCount: countWords(text),
    truncated
  };
}

async function checkPendingSelection() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getPendingSelection' });
    if (response?.pending) {
      elements.selectionToggle.checked = true;
      handleAnalyze({
        selectionOnlyOverride: true,
        expectedTabId: response.tabId
      });
    }
  } catch (error) {
    console.warn('Pending selection check failed:', error);
  }
}

function renderChunkBreakdown(chunkScores, chunksAnalyzed) {
  if (!Array.isArray(chunkScores) || chunkScores.length === 0) {
    elements.chunkBreakdown.classList.add('hidden');
    elements.chunkChart.innerHTML = '';
    elements.chunkList.innerHTML = '';
    return;
  }

  const count = chunksAnalyzed || chunkScores.length;
  elements.chunkCount.textContent = `${formatNumber(count)} chunks`;

  elements.chunkChart.innerHTML = '';
  elements.chunkList.innerHTML = '';

  chunkScores.forEach((score, index) => {
    const scoreValue = Number(score) || 0;
    const clampedScore = Math.min(1, Math.max(0, scoreValue));
    const scoreMeta = getScoreLabel(clampedScore);
    const height = Math.max(4, Math.round(clampedScore * 100));

    const bar = document.createElement('div');
    bar.className = `chunk-bar ${scoreMeta.class}`;
    bar.style.height = `${height}%`;
    bar.title = `Chunk ${index + 1}: ${clampedScore.toFixed(2)}`;
    elements.chunkChart.appendChild(bar);

    const item = document.createElement('li');
    item.className = 'chunk-item';

    const dot = document.createElement('span');
    dot.className = `chunk-dot ${scoreMeta.class}`;
    item.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = `#${index + 1} · ${clampedScore.toFixed(2)}`;
    item.appendChild(label);

    elements.chunkList.appendChild(item);
  });

  elements.chunkBreakdown.classList.remove('hidden');
}
