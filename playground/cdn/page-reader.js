/**
 * Page Reader + Language Picker — matches cbrowser.ai styling
 * Uses OpenAI TTS via cbrowser.ai CMS endpoint
 */
(function() {
  if (window.__pgReader) return;
  window.__pgReader = true;

  var CMS = 'https://cbrowser.ai/cms';
  var CHUNK_SIZE = 3000;

  // ── Shared styles ──
  var fabBase = {
    position: 'fixed', zIndex: '99997', width: '44px', height: '44px',
    borderRadius: '50%', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)', transition: 'transform 0.2s, box-shadow 0.2s',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  function makeFab(opts) {
    var btn = document.createElement('button');
    Object.assign(btn.style, fabBase, opts.style || {});
    btn.innerHTML = opts.icon;
    btn.title = opts.title;
    btn.setAttribute('aria-label', opts.title);
    if (opts.testid) btn.setAttribute('data-testid', opts.testid);
    btn.onmouseenter = function() { btn.style.transform = 'scale(1.08)'; btn.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)'; };
    btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'; };
    return btn;
  }

  // ── Icons (matching Lucide) ──
  var volumeIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  var pauseIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  var spinnerIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="animation:pgr-spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
  var globeIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

  // spinner animation
  var spinStyle = document.createElement('style');
  spinStyle.textContent = '@keyframes pgr-spin{to{transform:rotate(360deg)}} .pgr-hl{background:rgba(245,158,11,0.08)!important;outline:2px solid rgba(245,158,11,0.35)!important;outline-offset:2px;border-radius:4px;transition:outline 0.2s,background 0.2s}';
  document.head.appendChild(spinStyle);

  // ═══════════════════════════════════
  // READ ALOUD (OpenAI TTS via CMS)
  // ═══════════════════════════════════
  var playing = false, loading = false, audio = null, blocks = [], currentIdx = -1;
  var voice = 'nova', speed = 1.0;
  var prefetchCache = {};

  function extractBlocks() {
    var container = document.querySelector('#main') || document.querySelector('main') || document.body;
    var els = container.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption');
    var result = [], seen = new Set();
    els.forEach(function(el) {
      var text = el.innerText?.trim();
      if (!text || text.length < 10) return;
      if (seen.has(text)) return;
      if (el.closest('nav,header,footer,pre,code,script,style')) return;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      seen.add(text);
      result.push({ text: text, element: el });
    });
    return result;
  }

  function clearHL() {
    document.querySelectorAll('.pgr-hl').forEach(function(el) { el.classList.remove('pgr-hl'); });
  }

  function highlight(idx) {
    clearHL();
    if (idx >= 0 && idx < blocks.length) {
      blocks[idx].element.classList.add('pgr-hl');
      blocks[idx].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function fetchTTS(idx) {
    if (idx >= blocks.length) return Promise.resolve(null);
    var key = idx + '|' + voice + '|' + speed;
    if (prefetchCache[key]) return prefetchCache[key];
    var text = blocks[idx].text.slice(0, CHUNK_SIZE);
    var lang = localStorage.getItem('cbrowser-lang') || 'en';
    prefetchCache[key] = fetch(CMS + '/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, voice: voice, speed: speed, lang: lang }),
    }).then(function(r) { return r.ok ? r.blob() : null; }).catch(function() { return null; });
    return prefetchCache[key];
  }

  function speakOne(idx) {
    if (idx >= blocks.length) return Promise.resolve(false);
    currentIdx = idx;
    highlight(idx);
    loading = true;
    readBtn.innerHTML = spinnerIcon;
    // Prefetch next
    if (idx + 1 < blocks.length) fetchTTS(idx + 1);
    return fetchTTS(idx).then(function(blob) {
      loading = false;
      if (!blob || !playing) { readBtn.innerHTML = volumeIcon; return false; }
      readBtn.innerHTML = pauseIcon;
      var url = URL.createObjectURL(blob);
      if (audio) { audio.pause(); audio = null; }
      audio = new Audio(url);
      return new Promise(function(resolve) {
        audio.onended = function() { URL.revokeObjectURL(url); resolve(true); };
        audio.onerror = function() { URL.revokeObjectURL(url); resolve(false); };
        audio.play().catch(function() { resolve(false); });
      });
    });
  }

  function playFrom(idx) {
    playing = true;
    readBtn.style.background = '#d97706';
    (function next(i) {
      if (!playing || i >= blocks.length) { stopReading(); return; }
      speakOne(i).then(function(ok) { if (ok && playing) next(i + 1); else if (playing) stopReading(); });
    })(idx);
  }

  function stopReading() {
    playing = false; loading = false;
    if (audio) { audio.pause(); audio = null; }
    clearHL();
    currentIdx = -1;
    readBtn.innerHTML = volumeIcon;
    readBtn.style.background = '#f59e0b';
  }

  function toggleRead() {
    if (playing) { stopReading(); return; }
    blocks = extractBlocks();
    if (!blocks.length) return;
    prefetchCache = {};
    fetchTTS(0); // start prefetch immediately
    playFrom(0);
  }

  var readBtn = makeFab({
    icon: volumeIcon,
    title: 'Read page aloud',
    testid: 'read-aloud',
    style: { bottom: '20px', left: '72px', background: '#f59e0b', color: '#fff' },
  });
  readBtn.onclick = toggleRead;
  document.body.appendChild(readBtn);

  // ═══════════════════════════════════
  // LANGUAGE PICKER
  // ═══════════════════════════════════
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

  var currentLang = localStorage.getItem('cbrowser-lang') || 'en';
  var currentFlag = (LANGS.find(function(l) { return l.code === currentLang; }) || LANGS[0]).flag;
  var langOpen = false;
  var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  var langBtn = makeFab({
    icon: '<span style="font-size:20px;line-height:1">' + currentFlag + '</span>',
    title: 'Change language',
    testid: 'language-picker',
    style: {
      bottom: '20px', left: '124px',
      background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
      color: isDark ? '#e2e8f0' : '#1e293b',
      border: '1px solid ' + (isDark ? '#334155' : '#e2e8f0'),
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    },
  });

  // Panel
  var panel = document.createElement('div');
  panel.setAttribute('role', 'menu');
  panel.setAttribute('aria-label', 'Language selection');
  Object.assign(panel.style, {
    position: 'fixed', bottom: '72px', left: '124px', zIndex: '99997',
    background: isDark ? '#1e293b' : '#fff',
    border: '1px solid ' + (isDark ? '#334155' : '#e2e8f0'),
    borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    padding: '6px', display: 'none', width: '180px',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
  });

  LANGS.forEach(function(lang) {
    var opt = document.createElement('button');
    opt.setAttribute('role', 'menuitem');
    var isActive = lang.code === currentLang;
    Object.assign(opt.style, {
      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
      padding: '8px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer',
      fontSize: '13px', textAlign: 'left', minHeight: '40px',
      background: isActive ? (isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)') : 'transparent',
      color: isActive ? '#2563eb' : (isDark ? '#e2e8f0' : '#1e293b'),
      fontWeight: isActive ? '600' : '400',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      transition: 'background 0.15s',
    });
    opt.innerHTML = '<span style="font-size:18px">' + lang.flag + '</span><span>' + lang.label + '</span>';
    opt.onmouseenter = function() { if (!isActive) opt.style.background = isDark ? '#334155' : '#f1f5f9'; };
    opt.onmouseleave = function() { if (!isActive) opt.style.background = 'transparent'; };
    opt.onclick = function() {
      localStorage.setItem('cbrowser-lang', lang.code);
      panel.style.display = 'none';
      langOpen = false;
      location.reload();
    };
    panel.appendChild(opt);
  });

  langBtn.onclick = function(e) {
    e.stopPropagation();
    langOpen = !langOpen;
    panel.style.display = langOpen ? 'block' : 'none';
  };
  document.addEventListener('click', function() { if (langOpen) { panel.style.display = 'none'; langOpen = false; } });

  document.body.appendChild(langBtn);
  document.body.appendChild(panel);
})();
