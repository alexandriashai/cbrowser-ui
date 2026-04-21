/**
 * CBrowser Accessibility Widget — Embeddable FAB
 *
 * Drop this script on any page to add an accessibility controls panel.
 * Requires a Pro account + approved domain.
 *
 * Usage:
 *   <script src="https://cdn.cbrowser.ai/a11y-widget.js"
 *     data-key="cbk_YOUR_API_KEY"
 *     data-position="bottom-left"
 *     data-offset="20"
 *     data-size="48"
 *     data-color="#2563eb"
 *     data-icon="accessibility"
 *   ></script>
 *
 * Config attributes:
 *   data-key       — CBrowser API key (cbk_...) — required for domain validation
 *   data-position  — bottom-left (default), bottom-right, top-left, top-right
 *   data-offset    — Distance from edges in px (default: 20)
 *   data-size      — FAB button size in px (default: 48)
 *   data-color     — FAB button color (default: #2563eb)
 *   data-font      — Panel font family (default: system-ui)
 *   data-features  — Comma-separated list of enabled features, or "all" (default: all)
 *                     Options: fontSize, contrast, textSpacing, saturation, dyslexiaFont,
 *                              reducedMotion, largeCursor, readingGuide, focusHighlight, linkHighlight
 */

(function () {
  // Already loaded guard
  if ((window as any).__cbrowserA11yWidget) return;
  (window as any).__cbrowserA11yWidget = true;

  // ── Config from script tag ──
  const script = document.currentScript as HTMLScriptElement;
  const cfg = {
    key: script?.getAttribute('data-key') || '',
    position: script?.getAttribute('data-position') || 'bottom-left',
    offset: parseInt(script?.getAttribute('data-offset') || '20', 10),
    size: parseInt(script?.getAttribute('data-size') || '48', 10),
    color: script?.getAttribute('data-color') || '#2563eb',
    font: script?.getAttribute('data-font') || 'system-ui, -apple-system, sans-serif',
    icon: script?.getAttribute('data-icon') || 'accessibility',
    features: (script?.getAttribute('data-features') || 'all').split(',').map(s => s.trim()),
  };

  // ── Domain validation ──
  const domain = location.hostname;
  if (cfg.key) {
    fetch(`https://cbrowser.ai/cms/api/accounts/validate-widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: cfg.key, domain }),
    }).then(r => {
      if (!r.ok) {
        console.warn('[cbrowser-a11y] Domain not authorized or invalid key. Widget disabled.');
        return;
      }
      init();
    }).catch(() => init()); // Allow on network failure (graceful degradation)
  } else {
    init(); // No key = allow (for testing / localhost)
  }

  // ── Settings ──
  interface Settings {
    fontSize: number;
    contrast: number;
    dyslexiaFont: boolean;
    reducedMotion: boolean;
    largeCursor: boolean;
    readingGuide: boolean;
    textSpacing: number;
    focusHighlight: boolean;
    saturation: number;
    linkHighlight: boolean;
  }

  const DEFAULTS: Settings = {
    fontSize: 0, contrast: 0, dyslexiaFont: false, reducedMotion: false,
    largeCursor: false, readingGuide: false, textSpacing: 0,
    focusHighlight: false, saturation: 0, linkHighlight: false,
  };

  const STORAGE_KEY = 'cbrowser-a11y';

  function load(): Settings {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS;
    } catch { return DEFAULTS; }
  }

  function save(s: Settings) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }

  // ── Feature definitions ──
  const FEATURES = [
    { id: 'fontSize', type: 'stepper', label: 'Text Size', desc: 'Increase text size', icon: 'Aa', labels: ['Normal', 'Large', 'XL'], max: 2 },
    { id: 'contrast', type: 'stepper', label: 'Contrast', desc: 'Enhance color contrast', icon: '◑', labels: ['Normal', 'High', 'Invert'], max: 2 },
    { id: 'textSpacing', type: 'stepper', label: 'Text Spacing', desc: 'Wider letter/word spacing', icon: '↔', labels: ['Normal', 'Wide', 'XWide'], max: 2 },
    { id: 'saturation', type: 'stepper', label: 'Saturation', desc: 'Reduce color intensity', icon: '🎨', labels: ['Normal', 'Low', 'Gray'], max: 2 },
    { id: 'dyslexiaFont', type: 'toggle', label: 'Dyslexia Font', desc: 'OpenDyslexic typeface', icon: 'Dy' },
    { id: 'reducedMotion', type: 'toggle', label: 'Stop Motion', desc: 'Disable animations', icon: '⏸' },
    { id: 'largeCursor', type: 'toggle', label: 'Large Cursor', desc: 'Bigger cursor', icon: '🖱' },
    { id: 'readingGuide', type: 'toggle', label: 'Reading Guide', desc: 'Line follows cursor', icon: '📖' },
    { id: 'focusHighlight', type: 'toggle', label: 'Focus Ring', desc: 'Bold focus outlines', icon: '⊙' },
    { id: 'linkHighlight', type: 'toggle', label: 'Show Links', desc: 'Underline all links', icon: '🔗' },
  ];

  // ── CSS for the host page (accessibility effects) ──
  const HOST_CSS = `
    .cba11y-high-contrast { background: #000 !important; color: #fff !important; }
    .cba11y-high-contrast * { border-color: #fff !important; }
    .cba11y-inverted { filter: invert(1) hue-rotate(180deg); }
    .cba11y-inverted img, .cba11y-inverted video, .cba11y-inverted svg, .cba11y-inverted [data-cba11y-widget] { filter: invert(1) hue-rotate(180deg); }
    .cba11y-dyslexia, .cba11y-dyslexia * { font-family: 'OpenDyslexic', sans-serif !important; }
    .cba11y-no-motion, .cba11y-no-motion * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
    .cba11y-big-cursor, .cba11y-big-cursor * { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M5 2l18 14-8 2 4 10-4 2-4-10-6 6z' fill='%23000' stroke='%23fff' stroke-width='1'/%3E%3C/svg%3E") 5 2, auto !important; }
    .cba11y-spacing-1 { letter-spacing: 0.05em !important; word-spacing: 0.1em !important; line-height: 1.8 !important; }
    .cba11y-spacing-2 { letter-spacing: 0.12em !important; word-spacing: 0.2em !important; line-height: 2.2 !important; }
    .cba11y-focus *:focus, .cba11y-focus *:focus-visible { outline: 3px solid #3b82f6 !important; outline-offset: 2px !important; box-shadow: 0 0 0 6px rgba(59,130,246,0.25) !important; }
    .cba11y-low-sat { filter: saturate(0.5); }
    .cba11y-grayscale { filter: grayscale(1); }
    .cba11y-links a { text-decoration: underline !important; text-decoration-thickness: 2px !important; text-underline-offset: 3px !important; color: #2563eb !important; }
    .cba11y-links a:visited { color: #7c3aed !important; }
    .cba11y-guide { position: fixed; left: 0; right: 0; height: 4px; background: rgba(59,130,246,0.35); pointer-events: none; z-index: 99999; }
  `;

  // ── Shadow DOM CSS (widget panel styling) ──
  const WIDGET_CSS = `
    :host { all: initial; font-family: FONT; }
    * { box-sizing: border-box; margin: 0; }
    .fab { position: fixed; z-index: 99998; width: SIZEpx; height: SIZEpx; border-radius: 50%; background: COLOR; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: transform 0.15s, box-shadow 0.15s; font-size: calc(SIZE * 0.45)px; line-height: 1; }
    .fab:hover { transform: scale(1.05); box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
    .fab:focus-visible { outline: 3px solid COLOR; outline-offset: 3px; }
    .fab[aria-expanded="true"] { background: #475569; }
    .panel { position: fixed; z-index: 99998; width: 320px; max-height: 70vh; overflow-y: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); display: none; font-family: FONT; color: #0f172a; }
    .panel.open { display: block; }
    .panel-header { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; }
    .panel-header h2 { font-size: 14px; font-weight: 600; }
    .reset-btn { font-size: 11px; color: #64748b; background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; }
    .reset-btn:hover { background: #f1f5f9; color: #0f172a; }
    .panel-body { padding: 8px; }
    .toggle { width: 100%; display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; text-align: left; border: 1px solid transparent; background: none; cursor: pointer; transition: background 0.1s; min-height: 44px; }
    .toggle:hover { background: #f8fafc; }
    .toggle.active { background: rgba(37,99,235,0.06); border-color: rgba(37,99,235,0.2); }
    .toggle-icon { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; margin-top: 1px; color: #64748b; }
    .toggle.active .toggle-icon { color: COLOR; }
    .toggle-text { flex: 1; }
    .toggle-label { font-size: 13px; font-weight: 500; }
    .toggle.active .toggle-label { color: COLOR; }
    .toggle-desc { font-size: 11px; color: #64748b; margin-top: 1px; }
    .stepper-opts { display: flex; gap: 4px; margin: 6px 0 0 30px; }
    .step-btn { padding: 4px 10px; font-size: 11px; border-radius: 6px; border: none; cursor: pointer; background: #f1f5f9; color: #64748b; transition: background 0.1s; min-height: 32px; }
    .step-btn:hover { background: #e2e8f0; }
    .step-btn.active { background: COLOR; color: #fff; }
    .sep { height: 1px; background: #e2e8f0; margin: 4px 8px; }
    .footer { border-top: 1px solid #e2e8f0; padding: 8px 16px; text-align: center; font-size: 10px; color: #94a3b8; }
    .footer a { color: #64748b; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    @media (prefers-color-scheme: dark) {
      .panel { background: #1e293b; border-color: #334155; color: #e2e8f0; }
      .panel-header { background: #1e293b; border-color: #334155; }
      .toggle:hover { background: #334155; }
      .toggle.active { background: rgba(96,165,250,0.1); border-color: rgba(96,165,250,0.3); }
      .toggle-desc { color: #94a3b8; }
      .step-btn { background: #334155; color: #94a3b8; }
      .step-btn:hover { background: #475569; }
      .reset-btn { color: #94a3b8; }
      .reset-btn:hover { background: #334155; color: #e2e8f0; }
      .sep { background: #334155; }
      .footer { border-color: #334155; }
    }
  `
    .replace(/SIZE/g, String(cfg.size))
    .replace(/COLOR/g, cfg.color)
    .replace(/FONT/g, cfg.font);

  // ── Position helpers ──
  function fabPosition(): string {
    const o = cfg.offset;
    const p = cfg.position;
    const styles: string[] = [];
    if (p.includes('bottom')) styles.push(`bottom: ${o}px`);
    if (p.includes('top')) styles.push(`top: ${o}px`);
    if (p.includes('left')) styles.push(`left: ${o}px`);
    if (p.includes('right')) styles.push(`right: ${o}px`);
    return styles.join('; ');
  }

  function panelPosition(): string {
    const o = cfg.offset;
    const p = cfg.position;
    const btnGap = cfg.size + 12;
    const styles: string[] = [];
    if (p.includes('bottom')) styles.push(`bottom: ${o + btnGap}px`);
    if (p.includes('top')) styles.push(`top: ${o + btnGap}px`);
    if (p.includes('left')) styles.push(`left: ${o}px`);
    if (p.includes('right')) styles.push(`right: ${o}px`);
    return styles.join('; ');
  }

  // ── Apply settings to host document ──
  function applySettings(s: Settings) {
    const root = document.documentElement;

    root.style.fontSize = ['', '20px', '24px'][s.fontSize] || '';

    root.classList.toggle('cba11y-high-contrast', s.contrast === 1);
    root.classList.toggle('cba11y-inverted', s.contrast === 2);

    root.classList.toggle('cba11y-dyslexia', s.dyslexiaFont);
    if (s.dyslexiaFont && !document.getElementById('cba11y-dyslexic-font')) {
      const link = document.createElement('link');
      link.id = 'cba11y-dyslexic-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.cdnfonts.com/css/opendyslexic';
      document.head.appendChild(link);
    }

    root.classList.toggle('cba11y-no-motion', s.reducedMotion);
    root.classList.toggle('cba11y-big-cursor', s.largeCursor);
    root.classList.toggle('cba11y-spacing-1', s.textSpacing === 1);
    root.classList.toggle('cba11y-spacing-2', s.textSpacing === 2);
    root.classList.toggle('cba11y-focus', s.focusHighlight);
    root.classList.toggle('cba11y-low-sat', s.saturation === 1);
    root.classList.toggle('cba11y-grayscale', s.saturation === 2);
    root.classList.toggle('cba11y-links', s.linkHighlight);

    // Reading guide
    let guide = document.getElementById('cba11y-guide');
    if (s.readingGuide) {
      if (!guide) {
        guide = document.createElement('div');
        guide.id = 'cba11y-guide';
        guide.className = 'cba11y-guide';
        guide.setAttribute('aria-hidden', 'true');
        document.body.appendChild(guide);
        document.addEventListener('mousemove', (e) => {
          const g = document.getElementById('cba11y-guide');
          if (g) g.style.top = (e.clientY - 2) + 'px';
        }, { passive: true });
      }
      guide.style.display = '';
    } else if (guide) {
      guide.style.display = 'none';
    }

    save(s);
  }

  // ── Build the widget ──
  function init() {
    // Inject host CSS
    const hostStyle = document.createElement('style');
    hostStyle.textContent = HOST_CSS;
    document.head.appendChild(hostStyle);

    // Create shadow host
    const host = document.createElement('div');
    host.setAttribute('data-cba11y-widget', '');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    // Inject shadow CSS
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    shadow.appendChild(style);

    // State
    let settings = load();
    let isOpen = false;

    // Accessibility icon SVG
    const a11yIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="1.5"/><path d="M12 7v5"/><path d="m8 11 4 1 4-1"/><path d="m8 18 2.5-5"/><path d="M14.5 18 12 13"/></svg>`;
    const closeIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    // FAB button
    const fab = document.createElement('button');
    fab.className = 'fab';
    fab.innerHTML = a11yIcon;
    fab.setAttribute('aria-label', 'Accessibility settings');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('style', fabPosition());
    shadow.appendChild(fab);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Accessibility settings');
    panel.setAttribute('style', panelPosition());
    shadow.appendChild(panel);

    // Filter features
    const enabledFeatures = cfg.features.includes('all')
      ? FEATURES
      : FEATURES.filter(f => cfg.features.includes(f.id));

    function render() {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(DEFAULTS);
      panel.innerHTML = `
        <div class="panel-header">
          <h2>♿ Accessibility</h2>
          ${hasChanges ? '<button class="reset-btn" data-action="reset">↺ Reset</button>' : ''}
        </div>
        <div class="panel-body">
          ${enabledFeatures.map((f, i) => {
            const val = (settings as any)[f.id];
            if (f.type === 'stepper') {
              return `
                <div class="toggle ${val > 0 ? 'active' : ''}" data-feature="${f.id}" data-type="stepper">
                  <span class="toggle-icon">${f.icon}</span>
                  <div class="toggle-text">
                    <div class="toggle-label">${f.label}</div>
                    <div class="toggle-desc">${f.desc}</div>
                  </div>
                </div>
                <div class="stepper-opts">
                  ${(f as any).labels.map((l: string, j: number) =>
                    `<button class="step-btn ${val === j ? 'active' : ''}" data-feature="${f.id}" data-val="${j}">${l}</button>`
                  ).join('')}
                </div>
                ${i < enabledFeatures.length - 1 && enabledFeatures[i + 1]?.type !== 'stepper' ? '<div class="sep"></div>' : ''}
              `;
            }
            return `
              <button class="toggle ${val ? 'active' : ''}" data-feature="${f.id}" data-type="toggle" aria-pressed="${val}">
                <span class="toggle-icon">${f.icon}</span>
                <div class="toggle-text">
                  <div class="toggle-label">${f.label}</div>
                  <div class="toggle-desc">${f.desc}</div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
        <div class="footer">Powered by <a href="https://cbrowser.ai" target="_blank" rel="noopener">CBrowser</a></div>
      `;

      // Bind events
      panel.querySelectorAll('[data-action="reset"]').forEach(btn =>
        btn.addEventListener('click', () => {
          settings = { ...DEFAULTS };
          document.documentElement.removeAttribute('style');
          applySettings(settings);
          render();
        })
      );

      panel.querySelectorAll('[data-type="toggle"]').forEach(btn =>
        btn.addEventListener('click', () => {
          const feat = btn.getAttribute('data-feature')!;
          (settings as any)[feat] = !(settings as any)[feat];
          applySettings(settings);
          render();
        })
      );

      panel.querySelectorAll('.step-btn').forEach(btn =>
        btn.addEventListener('click', () => {
          const feat = btn.getAttribute('data-feature')!;
          const val = parseInt(btn.getAttribute('data-val')!, 10);
          (settings as any)[feat] = val;
          applySettings(settings);
          render();
        })
      );
    }

    // Toggle panel
    fab.addEventListener('click', () => {
      isOpen = !isOpen;
      panel.classList.toggle('open', isOpen);
      fab.setAttribute('aria-expanded', String(isOpen));
      fab.innerHTML = isOpen ? closeIcon : a11yIcon;
      if (isOpen) render();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        isOpen = false;
        panel.classList.remove('open');
        fab.setAttribute('aria-expanded', 'false');
        fab.innerHTML = a11yIcon;
        fab.focus();
      }
    });

    // Apply saved settings on load
    applySettings(settings);
  }
})();
