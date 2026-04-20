/**
 * cbrowser-ui v0.1.0 — JS Runtime
 *
 * Handles what CSS alone can't:
 * - Focus trap management (modals, drawers)
 * - Keyboard navigation (arrow keys, tab roving)
 * - Reduced motion detection
 * - Toast timing control
 * - Color scheme management
 * - Skip link behavior
 *
 * ~8kb gzipped. Zero dependencies.
 */

// ============================================
// FOCUS TRAP
// ============================================

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable]',
].join(', ');

interface TrapOptions {
  onEscape?: () => void;
  initialFocus?: HTMLElement | string;
  returnFocus?: boolean;
}

class FocusTrap {
  private el: HTMLElement;
  private previousFocus: HTMLElement | null = null;
  private options: TrapOptions;
  private boundHandler: (e: KeyboardEvent) => void;

  constructor(el: HTMLElement, options: TrapOptions = {}) {
    this.el = el;
    this.options = options;
    this.boundHandler = this.handleKeydown.bind(this);
  }

  activate() {
    this.previousFocus = document.activeElement as HTMLElement;
    document.addEventListener('keydown', this.boundHandler);

    // Focus initial element
    const target = typeof this.options.initialFocus === 'string'
      ? this.el.querySelector<HTMLElement>(this.options.initialFocus)
      : this.options.initialFocus;

    requestAnimationFrame(() => {
      if (target) {
        target.focus();
      } else {
        const first = this.getFocusable()[0];
        first?.focus();
      }
    });
  }

  deactivate() {
    document.removeEventListener('keydown', this.boundHandler);
    if (this.options.returnFocus !== false && this.previousFocus) {
      this.previousFocus.focus();
    }
  }

  private getFocusable(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.options.onEscape) {
      e.preventDefault();
      this.options.onEscape();
      return;
    }

    if (e.key !== 'Tab') return;

    const focusable = this.getFocusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

// ============================================
// KEYBOARD NAVIGATION (Arrow key roving)
// ============================================

function initArrowNav(container: HTMLElement, options: {
  selector?: string;
  orientation?: 'horizontal' | 'vertical' | 'both';
  wrap?: boolean;
} = {}) {
  const selector = options.selector || '[role="tab"], [role="menuitem"], .cui-nav a';
  const orientation = options.orientation || 'horizontal';
  const wrap = options.wrap !== false;

  container.addEventListener('keydown', (e: KeyboardEvent) => {
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;

    let next = -1;
    const isHorizontal = orientation === 'horizontal' || orientation === 'both';
    const isVertical = orientation === 'vertical' || orientation === 'both';

    if ((e.key === 'ArrowRight' && isHorizontal) || (e.key === 'ArrowDown' && isVertical)) {
      next = wrap ? (current + 1) % items.length : Math.min(current + 1, items.length - 1);
    } else if ((e.key === 'ArrowLeft' && isHorizontal) || (e.key === 'ArrowUp' && isVertical)) {
      next = wrap ? (current - 1 + items.length) % items.length : Math.max(current - 1, 0);
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = items.length - 1;
    }

    if (next !== -1) {
      e.preventDefault();
      items[next].focus();
      // Update aria-selected for tabs
      if (items[next].getAttribute('role') === 'tab') {
        items.forEach(i => i.setAttribute('aria-selected', 'false'));
        items[next].setAttribute('aria-selected', 'true');
      }
    }
  });
}

// ============================================
// REDUCED MOTION
// ============================================

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function onMotionPreferenceChange(callback: (reduced: boolean) => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

// ============================================
// COLOR SCHEME
// ============================================

type ColorScheme = 'light' | 'dark' | 'system';

function setColorScheme(scheme: ColorScheme) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');

  if (scheme === 'system') {
    localStorage.removeItem('cui-color-scheme');
    root.classList.remove('light', 'dark');
  } else {
    localStorage.setItem('cui-color-scheme', scheme);
    root.classList.remove('light', 'dark');
    root.classList.add(scheme);
  }
}

function getColorScheme(): ColorScheme {
  return (localStorage.getItem('cui-color-scheme') as ColorScheme) || 'system';
}

// ============================================
// TOAST / NOTIFICATION TIMING
// ============================================

interface ToastOptions {
  duration?: number;       // ms, default 5000. 0 = no auto-dismiss
  pauseOnHover?: boolean;  // default true
  pauseOnFocus?: boolean;  // default true
  role?: 'status' | 'alert';
}

function createToast(message: string, container: HTMLElement, options: ToastOptions = {}) {
  const duration = options.duration ?? 5000;
  const pauseOnHover = options.pauseOnHover !== false;
  const pauseOnFocus = options.pauseOnFocus !== false;

  const toast = document.createElement('div');
  toast.setAttribute('role', options.role || 'status');
  toast.setAttribute('aria-live', options.role === 'alert' ? 'assertive' : 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.className = 'cui-toast';
  toast.textContent = message;

  // Dismiss button
  const dismiss = document.createElement('button');
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '×';
  dismiss.className = 'cui-toast-dismiss';
  dismiss.onclick = () => removeToast();
  toast.appendChild(dismiss);

  container.appendChild(toast);

  let timeout: ReturnType<typeof setTimeout> | null = null;
  let remaining = duration;
  let startTime = Date.now();

  function startTimer() {
    if (duration <= 0 || prefersReducedMotion()) return; // Never auto-dismiss with reduced motion
    startTime = Date.now();
    timeout = setTimeout(removeToast, remaining);
  }

  function pauseTimer() {
    if (timeout) {
      clearTimeout(timeout);
      remaining -= Date.now() - startTime;
    }
  }

  function removeToast() {
    if (timeout) clearTimeout(timeout);
    toast.remove();
  }

  if (pauseOnHover) {
    toast.addEventListener('mouseenter', pauseTimer);
    toast.addEventListener('mouseleave', startTimer);
  }
  if (pauseOnFocus) {
    toast.addEventListener('focusin', pauseTimer);
    toast.addEventListener('focusout', startTimer);
  }

  startTimer();
  return { dismiss: removeToast, el: toast };
}

// ============================================
// AUTO-INIT (data-cui-* attributes)
// ============================================

function autoInit() {
  // Focus traps: data-cui-trap
  document.querySelectorAll<HTMLElement>('[data-cui-trap]').forEach(el => {
    const trap = new FocusTrap(el, {
      onEscape: () => el.setAttribute('hidden', ''),
      returnFocus: true,
    });
    // Observe visibility
    const observer = new MutationObserver(() => {
      if (!el.hidden) trap.activate();
      else trap.deactivate();
    });
    observer.observe(el, { attributes: true, attributeFilter: ['hidden'] });
    if (!el.hidden) trap.activate();
  });

  // Arrow nav: data-cui-arrows
  document.querySelectorAll<HTMLElement>('[data-cui-arrows]').forEach(el => {
    const orientation = el.dataset.cuiArrows as 'horizontal' | 'vertical' | 'both' || 'horizontal';
    initArrowNav(el, { orientation });
  });

  // Skip links
  document.querySelectorAll<HTMLAnchorElement>('.cui-skip-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector<HTMLElement>(link.getAttribute('href') || '');
      if (target) {
        e.preventDefault();
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.removeAttribute('tabindex');
      }
    });
  });

  // Color scheme from localStorage
  const saved = getColorScheme();
  if (saved !== 'system') setColorScheme(saved);
}

// Run on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit);
} else {
  autoInit();
}

// ============================================
// PUBLIC API
// ============================================

export {
  FocusTrap,
  initArrowNav,
  prefersReducedMotion,
  onMotionPreferenceChange,
  setColorScheme,
  getColorScheme,
  createToast,
  autoInit,
};

export type { TrapOptions, ToastOptions, ColorScheme };
