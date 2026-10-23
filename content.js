(() => {
  'use strict';
  const GEMINI_URL = 'https://gemini.google.com/app';
  const TO_REMOTE = 'antigravity-remote-btn';
  const TO_GEMINI = 'gemini-back-btn';
  const isGemini = location.origin === 'https://gemini.google.com';
  const inFrame = window.self !== window.top;
  if (inFrame && isGemini) return;
  if (!isGemini && !BridgeConfig.isRemoteFrame(location.href)) return;
  if (!inFrame && !isGemini && !BridgeConfig.isEndpoint(location.href)) return;

  function showError(button, error) {
    button.title = error.message || 'Reload the extension and this page.';
    button.setAttribute('aria-label', button.title);
  }
  function button(id, label, icon, ariaLabel) {
    const el = document.createElement('button');
    el.id = id;
    el.className = 'antigravity-bridge-btn';
    el.type = 'button';
    el.title = ariaLabel;
    el.setAttribute('aria-label', ariaLabel);
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL(icon);
    img.alt = '';
    img.className = 'antigravity-icon';
    img.width = img.height = 16;
    const text = document.createElement('span');
    text.textContent = label;
    el.append(img, text);
    return el;
  }
  function handleClicks(el, navigate) {
    const handler = event => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      navigate(event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1);
    };
    el.addEventListener('click', handler);
    el.addEventListener('auxclick', handler);
  }
  function openGemini(newTab) {
    if (newTab) window.open(GEMINI_URL, '_blank', 'noopener');
    else if (inFrame) window.parent.postMessage({ type: 'ANTIGRAVITY_RETURN_TO_GEMINI' }, parentOrigin);
    else window.location.href = GEMINI_URL;
  }
  const parentOrigin = (() => {
    try {
      if (BridgeConfig.isEndpoint(document.referrer)) return new URL(document.referrer).origin;
    } catch { /* The official shell is the only fallback receiver. */ }
    return 'https://antigravity.google.com';
  })();
  let ownButton;
  let observedFrame;
  let frameLayout = null;
  let pendingFrame;
  let queued = false;
  let stopped = false;
  let lastReport = '';
  const frameLoads = new WeakSet();

  function getButton() {
    if (!ownButton) {
      ownButton = isGemini
        ? button(TO_REMOTE, 'Antigravity', 'antigravity-logo.png', 'Open Antigravity Remote Control')
        : button(TO_GEMINI, 'Gemini', 'gemini-logo.png', 'Return to Gemini');
      handleClicks(ownButton, newTab => {
        if (!isGemini) { openGemini(newTab); return; }
        // Open during the click gesture so popup blockers do not discard Ctrl/middle-click.
        const opened = newTab ? window.open('about:blank', '_blank') : null;
        if (opened) opened.opener = null;
        chrome.storage.sync.get({ antigravityUrl: BridgeConfig.DEFAULT_URL }, data => {
          try {
            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            const target = BridgeConfig.endpoint(data.antigravityUrl);
            if (newTab) {
              if (opened) opened.location.href = target;
            } else window.location.href = target;
          } catch (error) {
            if (opened) opened.close();
            showError(ownButton, error);
          }
        });
      });
    }
    return ownButton;
  }
  function schedule() {
    if (queued || stopped) return;
    queued = true;
    pendingFrame = requestAnimationFrame(() => { queued = false; mount(); });
  }
  function sendLayout(inline, left = null) {
    const report = { type: 'ANTIGRAVITY_INNER_LAYOUT', inline, left };
    const serialized = JSON.stringify(report);
    if (serialized !== lastReport) {
      lastReport = serialized;
      window.parent.postMessage(report, parentOrigin);
    }
  }
  function mountInFrame() {
    const anchor = document.querySelector('[data-testid="titlebar-more-actions"]') ||
      document.querySelector('button[aria-label="More actions"]') ||
      document.querySelector('[data-testid="toggle-overview-panel"]');
    if (anchor?.parentElement) {
      const el = getButton();
      el.classList.add('antigravity-bridge-inline');
      if (el.parentElement !== anchor.parentElement || el.nextSibling !== anchor) {
        anchor.parentElement.insertBefore(el, anchor);
      }
      sendLayout(true);
      return;
    }
    ownButton?.remove();
    // Older/custom workspaces keep the existing measured-position fallback.
    const controls = [...document.querySelectorAll(
      '[title*="Auxiliary" i], [aria-label*="Auxiliary" i], ' +
      '[aria-label*="Sidebar" i], [aria-label*="More" i], ' +
      '.codicon-layout-sidebar-right, .codicon-layout-panel, .codicon-more, .codicon-ellipsis'
    )].map(el => el.getBoundingClientRect()).filter(r =>
      r.top >= 0 && r.top <= 50 && r.left >= innerWidth * .25 && r.width >= 16 && r.height >= 16);
    sendLayout(false, controls.length ? Math.min(...controls.map(r => r.left)) : null);
  }
  function trackFrame() {
    const next = [...document.querySelectorAll('iframe')].find(el => BridgeConfig.isRemoteFrame(el.src));
    if (next !== observedFrame) {
      observedFrame = next;
      frameLayout = null;
      probeFrame();
    }
    if (next && !frameLoads.has(next)) {
      frameLoads.add(next);
      next.addEventListener('load', () => {
        if (next !== observedFrame) return;
        frameLayout = null;
        probeFrame();
        schedule();
      });
    }
  }
  function probeFrame() {
    if (!observedFrame?.contentWindow) return;
    observedFrame.contentWindow.postMessage({ type: 'ANTIGRAVITY_LAYOUT_PROBE' }, new URL(observedFrame.src).origin);
  }
  function trustedFrame(event) {
    if (!observedFrame || event.source !== observedFrame.contentWindow) return false;
    try {
      return BridgeConfig.isRemoteFrame(observedFrame.src) && event.origin === new URL(observedFrame.src).origin;
    } catch { return false; }
  }
  function mountGemini() {
    document.querySelectorAll('header button, header a, .top-bar-actions button, .top-bar-actions a').forEach(el => {
      const text = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
      if (/scarica|download|install/.test(text) && el.style.display !== 'none') el.style.display = 'none';
    });
    const temp = document.querySelector('temp-chat-button');
    const container = temp?.parentElement || document.querySelector('.top-bar-actions, header .header-actions, header div[role="region"], header');
    if (!container) return;
    const el = getButton();
    if (el.parentElement !== container) {
      const profile = temp || container.querySelector('[aria-haspopup="menu"], button[aria-label*="Google"], img[alt*="profile" i]');
      if (profile?.parentElement === container) container.insertBefore(el, profile);
      else container.append(el);
    }
  }
  function mountRemote() {
    trackFrame();
    if (frameLayout?.inline) { ownButton?.remove(); return; }
    const candidates = [...document.querySelectorAll(
      '.header-feedback-btn, [aria-label*="feedback" i], [title*="feedback" i], ' +
      '[aria-label*="Google Account" i], button, [role="button"], a'
    )].filter(el => el !== ownButton && !ownButton?.contains(el)).map(el => el.getBoundingClientRect())
      .filter(r => r.top >= 0 && r.top <= 40 && r.bottom <= 55 && r.width >= 16 && r.height >= 16 && r.left >= innerWidth * .4)
      .sort((a, b) => a.left - b.left);
    if (!candidates.length) { ownButton?.remove(); return; }
    const cluster = candidates[0];
    let left = cluster.left;
    if (Number.isFinite(frameLayout?.left) && observedFrame) {
      left = Math.min(left, frameLayout.left + observedFrame.getBoundingClientRect().left);
    } else if (!frameLayout && /(?:p=c%2f|\/c\/|\/chat|conversation=)/i.test(location.href)) {
      left -= 105;
    }
    const el = getButton();
    const top = Math.max(4, Math.round(cluster.top));
    const right = Math.max(10, Math.round(innerWidth - left + 8));
    // Avoid writing identical styles: our own MutationObserver must settle.
    if (el.style.top !== `${top}px`) el.style.top = `${top}px`;
    if (el.style.right !== `${right}px`) el.style.right = `${right}px`;
    if (el.parentElement !== document.body) document.body.append(el);
  }
  function mount() {
    if (!document.documentElement || !document.body) return;
    if (inFrame) mountInFrame();
    else if (isGemini) mountGemini();
    else mountRemote();
  }
  window.addEventListener('message', event => {
    if (inFrame) {
      if (event.source === window.parent && event.origin === parentOrigin && event.data?.type === 'ANTIGRAVITY_LAYOUT_PROBE') {
        lastReport = '';
        schedule();
      }
      return;
    }
    if (isGemini || !trustedFrame(event)) return;
    if (event.data?.type === 'ANTIGRAVITY_RETURN_TO_GEMINI') { openGemini(false); return; }
    if (event.data?.type !== 'ANTIGRAVITY_INNER_LAYOUT' || typeof event.data.inline !== 'boolean') return;
    const left = event.data.left;
    if (left !== null && (!Number.isFinite(left) || left < 0 || left > observedFrame.getBoundingClientRect().width)) return;
    frameLayout = { inline: event.data.inline, left };
    schedule();
  });
  const observer = new MutationObserver(records => {
    if (records.some(r => r.type === 'childList' || (r.target !== ownButton && !ownButton?.contains(r.target)))) schedule();
  });
  function watch() {
    stopped = false;
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'src'] });
    mount();
  }
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pagehide', () => {
    stopped = true;
    observer.disconnect();
    cancelAnimationFrame(pendingFrame);
    queued = false;
    if (inFrame) sendLayout(false);
  });
  window.addEventListener('pageshow', watch);
  watch();
})();
