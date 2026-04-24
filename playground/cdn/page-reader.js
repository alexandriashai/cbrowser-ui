/**
 * Page Reader + Language Picker — standalone, no dependencies
 * Uses Web Speech API for TTS (no server needed)
 *
 * Creates two fixed buttons:
 *   1. Read Aloud (amber) — reads page content with Web Speech API
 *   2. Language Picker (gray) — translates page via Google Translate widget
 */
(function() {
  if (window.__pgReader) return;
  window.__pgReader = true;

  // ── Read Aloud Button ──
  var playing = false;
  var utterance = null;
  var blocks = [];
  var currentIdx = -1;

  function extractBlocks() {
    var container = document.querySelector('#main') || document.querySelector('main') || document.body;
    var els = container.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption');
    var result = [];
    var seen = new Set();
    els.forEach(function(el) {
      var text = el.innerText?.trim();
      if (!text || text.length < 10) return;
      if (seen.has(text)) return;
      if (el.closest('nav, header, footer, pre, code, script, style')) return;
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      seen.add(text);
      result.push({ text: text, element: el });
    });
    return result;
  }

  function clearHighlights() {
    document.querySelectorAll('.pgr-highlight').forEach(function(el) {
      el.style.backgroundColor = '';
      el.style.outline = '';
      el.classList.remove('pgr-highlight');
    });
  }

  function highlightBlock(idx) {
    clearHighlights();
    if (idx >= 0 && idx < blocks.length) {
      var el = blocks[idx].element;
      el.classList.add('pgr-highlight');
      el.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
      el.style.outline = '2px solid rgba(245, 158, 11, 0.4)';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function stopReading() {
    playing = false;
    speechSynthesis.cancel();
    clearHighlights();
    currentIdx = -1;
    readBtn.innerHTML = speakerIcon;
    readBtn.style.background = '#f59e0b';
    readBtn.title = 'Read page aloud';
  }

  function speakBlock(idx) {
    if (idx >= blocks.length) { stopReading(); return; }
    currentIdx = idx;
    highlightBlock(idx);

    utterance = new SpeechSynthesisUtterance(blocks[idx].text);
    utterance.rate = 1.0;
    utterance.onend = function() {
      if (playing) speakBlock(idx + 1);
    };
    utterance.onerror = function() {
      if (playing) speakBlock(idx + 1);
    };
    speechSynthesis.speak(utterance);
  }

  function toggleReading() {
    if (playing) {
      stopReading();
      return;
    }
    blocks = extractBlocks();
    if (blocks.length === 0) return;
    playing = true;
    readBtn.innerHTML = pauseIcon;
    readBtn.style.background = '#d97706';
    readBtn.title = 'Stop reading';
    speakBlock(0);
  }

  var speakerIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  var pauseIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

  var readBtn = document.createElement('button');
  readBtn.innerHTML = speakerIcon;
  readBtn.title = 'Read page aloud';
  readBtn.setAttribute('aria-label', 'Read page aloud');
  readBtn.setAttribute('data-testid', 'read-aloud');
  Object.assign(readBtn.style, {
    position: 'fixed', bottom: '20px', left: '72px', zIndex: '99997',
    width: '44px', height: '44px', borderRadius: '50%',
    background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)', transition: 'transform 0.15s, background 0.15s',
  });
  readBtn.onmouseenter = function() { readBtn.style.transform = 'scale(1.05)'; };
  readBtn.onmouseleave = function() { readBtn.style.transform = 'scale(1)'; };
  readBtn.onclick = toggleReading;
  document.body.appendChild(readBtn);

  // ── Language Picker ──
  var LANGS = [
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'ja', flag: '🇯🇵', label: '日本語' },
    { code: 'zh', flag: '🇨🇳', label: '中文' },
    { code: 'ko', flag: '🇰🇷', label: '한국어' },
    { code: 'pt', flag: '🇧🇷', label: 'Português' },
    { code: 'ar', flag: '🇸🇦', label: 'العربية' },
    { code: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
  ];

  var langOpen = false;
  var currentLang = localStorage.getItem('cbrowser-lang') || 'en';
  var currentFlag = (LANGS.find(function(l) { return l.code === currentLang; }) || LANGS[0]).flag;

  var langBtn = document.createElement('button');
  langBtn.innerHTML = currentFlag;
  langBtn.title = 'Change language';
  langBtn.setAttribute('aria-label', 'Change language');
  langBtn.setAttribute('data-testid', 'language-picker');
  Object.assign(langBtn.style, {
    position: 'fixed', bottom: '20px', left: '124px', zIndex: '99997',
    width: '44px', height: '44px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.9)', color: '#1e293b', border: '1px solid #e2e8f0',
    cursor: 'pointer', fontSize: '20px', lineHeight: '1',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', transition: 'transform 0.15s',
    backdropFilter: 'blur(8px)',
  });
  langBtn.onmouseenter = function() { langBtn.style.transform = 'scale(1.05)'; };
  langBtn.onmouseleave = function() { langBtn.style.transform = 'scale(1)'; };

  var langPanel = document.createElement('div');
  langPanel.setAttribute('role', 'menu');
  langPanel.setAttribute('aria-label', 'Language selection');
  Object.assign(langPanel.style, {
    position: 'fixed', bottom: '72px', left: '124px', zIndex: '99997',
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '8px',
    display: 'none', width: '180px',
  });

  LANGS.forEach(function(lang) {
    var opt = document.createElement('button');
    opt.setAttribute('role', 'menuitem');
    opt.innerHTML = '<span style="margin-right:8px">' + lang.flag + '</span>' + lang.label;
    Object.assign(opt.style, {
      display: 'flex', alignItems: 'center', width: '100%', padding: '8px 12px',
      border: 'none', background: lang.code === currentLang ? 'rgba(37,99,235,0.08)' : 'transparent',
      borderRadius: '8px', cursor: 'pointer', fontSize: '13px', textAlign: 'left',
      minHeight: '40px', transition: 'background 0.1s',
    });
    opt.onmouseenter = function() { opt.style.background = '#f1f5f9'; };
    opt.onmouseleave = function() { opt.style.background = lang.code === currentLang ? 'rgba(37,99,235,0.08)' : 'transparent'; };
    opt.onclick = function() {
      currentLang = lang.code;
      localStorage.setItem('cbrowser-lang', lang.code);
      langBtn.innerHTML = lang.flag;
      langPanel.style.display = 'none';
      langOpen = false;
      // Use Google Translate for page translation
      if (lang.code === 'en') {
        // Remove translation
        var frame = document.querySelector('.goog-te-banner-frame');
        if (frame) frame.remove();
        document.body.style.top = '';
        location.reload();
      } else {
        // Trigger Google Translate
        var gtScript = document.getElementById('gt-script');
        if (!gtScript) {
          window.googleTranslateElementInit = function() {
            new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: LANGS.map(function(l) { return l.code; }).join(','), autoDisplay: false }, 'gt-holder');
            setTimeout(function() {
              var sel = document.querySelector('.goog-te-combo');
              if (sel) { sel.value = lang.code; sel.dispatchEvent(new Event('change')); }
            }, 1000);
          };
          var holder = document.createElement('div');
          holder.id = 'gt-holder';
          holder.style.display = 'none';
          document.body.appendChild(holder);
          var s = document.createElement('script');
          s.id = 'gt-script';
          s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
          document.body.appendChild(s);
        } else {
          var sel = document.querySelector('.goog-te-combo');
          if (sel) { sel.value = lang.code; sel.dispatchEvent(new Event('change')); }
        }
      }
    };
    langPanel.appendChild(opt);
  });

  langBtn.onclick = function() {
    langOpen = !langOpen;
    langPanel.style.display = langOpen ? 'block' : 'none';
  };

  // Close on outside click
  document.addEventListener('click', function(e) {
    if (langOpen && !langBtn.contains(e.target) && !langPanel.contains(e.target)) {
      langPanel.style.display = 'none';
      langOpen = false;
    }
  });

  document.body.appendChild(langBtn);
  document.body.appendChild(langPanel);

  // Dark mode support
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    langBtn.style.background = 'rgba(30,41,59,0.9)';
    langBtn.style.color = '#e2e8f0';
    langBtn.style.borderColor = '#334155';
    langPanel.style.background = '#1e293b';
    langPanel.style.borderColor = '#334155';
    langPanel.style.color = '#e2e8f0';
  }
})();
