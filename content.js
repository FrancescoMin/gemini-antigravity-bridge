(() => {
  const GEMINI_URL = 'https://gemini.google.com/app';
  const DEFAULT_ANTIGRAVITY_URL = 'https://antigravity.google.com';

  const hostname = window.location.hostname;
  const isGemini = hostname === 'gemini.google.com' || hostname.endsWith('.gemini.google.com');
  const isDefaultAntigravity =
    hostname === 'antigravity.google.com' ||
    hostname.endsWith('.antigravity.google.com') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

  const BTN_TO_ANTIGRAVITY_ID = 'antigravity-remote-btn';
  const BTN_TO_GEMINI_ID = 'gemini-back-btn';

  // --- LOGICA IFRAME INTERNO (VS Code / Conversazione Antigravity) ---
  if (window.self !== window.top) {
    const isAntigravityFrame =
      isDefaultAntigravity ||
      hostname.endsWith('.usercontent.goog');

    if (isAntigravityFrame) {
      // Ignora frame secondari, nascosti o di telemetria (solo il workspace a pieno schermo)
      if (window.innerWidth < 400 || window.innerHeight < 300) {
        return;
      }

      function scanAndReport() {
        const layoutControls = document.querySelectorAll(
          '[title*="Auxiliary" i], [aria-label*="Auxiliary" i], ' +
          '[title*="Pane" i], [aria-label*="Pane" i], ' +
          '[title*="Sidebar" i], [aria-label*="Sidebar" i], ' +
          '[title*="More" i], [aria-label*="More" i], ' +
          '[title*="Layout" i], [aria-label*="Layout" i], ' +
          '.codicon-layout-sidebar-right, .codicon-layout-panel, .codicon-more, .codicon-ellipsis, ' +
          '.codicon-layout-control-options, [class*="layout-" i], [class*="codicon-layout" i]'
        );

        let minLeft = window.innerWidth;
        let found = false;

        for (const el of layoutControls) {
          const toolbar = el.closest('.monaco-toolbar, .actions-container, [role="toolbar"], div[class*="toolbar" i]');
          const target = (toolbar && toolbar.getBoundingClientRect().width <= 250) ? toolbar : el;
          const r = target.getBoundingClientRect();
          if (r.top >= 0 && r.top <= 50 && r.left >= window.innerWidth * 0.25 && r.width >= 16 && r.height >= 16) {
            if (r.left < minLeft) {
              minLeft = r.left;
              found = true;
            }
          }
        }

        // Segnala al top window sia la presenza (con coordinate) che l'assenza dei controlli
        if (found) {
          window.parent.postMessage({
            type: 'ANTIGRAVITY_INNER_LAYOUT',
            hasControls: true,
            left: minLeft
          }, '*');
        } else {
          window.parent.postMessage({
            type: 'ANTIGRAVITY_INNER_LAYOUT',
            hasControls: false,
            left: null
          }, '*');
        }
      }

      setInterval(scanAndReport, 100);
      window.addEventListener('mousemove', (e) => {
        if (e.buttons === 1) scanAndReport();
      });
      window.addEventListener('resize', scanAndReport);
      setTimeout(scanAndReport, 100);
      setTimeout(scanAndReport, 300);
      setTimeout(scanAndReport, 600);
    }
    return; // Non iniettare pulsanti all'interno dell'iframe
  }

  function cleanupStrayButtons() {
    const strayGeminiBtn = document.getElementById(BTN_TO_GEMINI_ID);
    if (strayGeminiBtn) strayGeminiBtn.remove();
    const strayAgBtn = document.getElementById(BTN_TO_ANTIGRAVITY_ID);
    if (strayAgBtn) strayAgBtn.remove();
  }

  // Se siamo su Gemini, rimuovi assolutamente qualsiasi residuo di gemini-back-btn
  if (isGemini) {
    cleanupStrayButtons();
    initBridge(true, false);
    return;
  }

  if (isDefaultAntigravity) {
    cleanupStrayButtons();
    initBridge(false, true);
    return;
  }

  // Se non siamo né su Gemini né sull'Antigravity predefinito,
  // controlla se l'host attuale corrisponde all'endpoint personalizzato configurato nelle opzioni.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ antigravityUrl: DEFAULT_ANTIGRAVITY_URL }, (data) => {
      try {
        if (data && data.antigravityUrl) {
          const parsed = new URL(data.antigravityUrl);
          if (parsed.hostname === hostname) {
            cleanupStrayButtons();
            initBridge(false, true);
            return;
          }
        }
      } catch (e) {}
      cleanupStrayButtons();
    });
  } else {
    cleanupStrayButtons();
  }

  function initBridge(isGemini, isAntigravity) {
    // --- GEMINI LOGIC (Go to Antigravity) ---
    function createToAntigravityButton() {
      const btn = document.createElement('button');
      btn.id = BTN_TO_ANTIGRAVITY_ID;
      btn.className = 'antigravity-bridge-btn';
      btn.type = 'button';
      btn.title = 'Open Antigravity remote session (or Ctrl+click for new tab)';
      btn.setAttribute('aria-label', 'Open Antigravity Remote Control');

      const iconUrl = chrome.runtime.getURL('antigravity-logo.png');

      btn.innerHTML = `
        <img src="${iconUrl}" alt="" class="antigravity-icon" width="16" height="16">
        <span>Antigravity</span>
      `;

      const handleNavigation = (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.storage.sync.get({ antigravityUrl: DEFAULT_ANTIGRAVITY_URL }, (data) => {
          const targetUrl = data.antigravityUrl;
          if (e.ctrlKey || e.metaKey || e.button === 1) {
            window.open(targetUrl, '_blank');
          } else {
            window.location.href = targetUrl;
          }
        });
      };

      btn.addEventListener('click', handleNavigation);
      btn.addEventListener('auxclick', (e) => {
        if (e.button === 1) handleNavigation(e);
      });

      return btn;
    }

    function injectOnGemini() {
      hideDownloadAppButton();
      if (document.getElementById(BTN_TO_ANTIGRAVITY_ID)) return;

      const targetContainer =
        document.querySelector('.top-bar-actions') ||
        document.querySelector('header .header-actions') ||
        document.querySelector('header div[role="region"]') ||
        document.querySelector('header');

      if (!targetContainer) return;

      const btn = createToAntigravityButton();
      const profileSection = targetContainer.querySelector(
        '[aria-haspopup="menu"], button[aria-label*="Google"], img[alt*="profile" i], img[alt*="profilo" i]'
      );

      if (profileSection && profileSection.parentElement === targetContainer) {
        targetContainer.insertBefore(btn, profileSection);
      } else {
        targetContainer.appendChild(btn);
      }
    }

    function hideDownloadAppButton() {
      const elements = document.querySelectorAll(
        'header button, header a, .top-bar-actions button, .top-bar-actions a'
      );
      elements.forEach((el) => {
        const text = (el.textContent || '').toLowerCase();
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        const hasDownloadIcon = el.querySelector(
          'mat-icon[data-mat-icon-name*="download"], mat-icon[fonticon*="download"], svg[data-icon*="download"]'
        );
        const hasInstallText =
          text.includes('scarica') ||
          text.includes('download') ||
          text.includes('install') ||
          label.includes('scarica') ||
          label.includes('download') ||
          label.includes('install');

        if (hasDownloadIcon || hasInstallText) {
          el.style.display = 'none';
        }
      });
    }

    // --- ANTIGRAVITY LOGIC (Return to Gemini) ---
    let innerLayoutLeft = null;
    let hasInnerControls = null;

    if (isAntigravity) {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'ANTIGRAVITY_INNER_LAYOUT') {
          const hadControls = hasInnerControls;
          const prevLeft = innerLayoutLeft;

          if (e.data.hasControls === true && typeof e.data.left === 'number') {
            let iframeOffsetLeft = 0;
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
              if (iframe.contentWindow === e.source) {
                iframeOffsetLeft = iframe.getBoundingClientRect().left;
                break;
              }
            }
            hasInnerControls = true;
            innerLayoutLeft = e.data.left + iframeOffsetLeft;
          } else if (e.data.hasControls === false) {
            hasInnerControls = false;
            innerLayoutLeft = null;
          }

          // Esegui il riposizionamento solo se qualcosa è effettivamente mutato
          if (hasInnerControls !== hadControls || innerLayoutLeft !== prevLeft) {
            injectOnAntigravity();
          }
        }
      });

      // Rileva quando l'utente clicca su "+ New Conversation" o su Home per resettare la posizione accanto al feedback
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target) return;
        const text = (target.textContent || '').toLowerCase();
        const label = (target.getAttribute && (target.getAttribute('aria-label') || target.getAttribute('title')) || '').toLowerCase();
        if (
          text.includes('new conversation') ||
          label.includes('new conversation') ||
          text.includes('nuova conversazione') ||
          label.includes('nuova conversazione')
        ) {
          hasInnerControls = false;
          innerLayoutLeft = null;
          injectOnAntigravity();
          setTimeout(injectOnAntigravity, 50);
          setTimeout(injectOnAntigravity, 200);
          setTimeout(injectOnAntigravity, 500);
        }
      }, true);

      window.addEventListener('mousemove', (e) => {
        if (e.buttons === 1) {
          injectOnAntigravity();
        }
      });
    }

    function createToGeminiButton() {
      if (!isAntigravity) return null;
      const btn = document.createElement('button');
      btn.id = BTN_TO_GEMINI_ID;
      btn.className = 'antigravity-bridge-btn';
      btn.type = 'button';
      btn.title = 'Return to Gemini app (or Ctrl+click for new tab)';
      btn.setAttribute('aria-label', 'Return to Gemini');

      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>
        </svg>
        <span>Gemini</span>
      `;

      const handleNavigation = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey || e.button === 1) {
          window.open(GEMINI_URL, '_blank');
        } else {
          window.location.href = GEMINI_URL;
        }
      };

      btn.addEventListener('click', handleNavigation);
      btn.addEventListener('auxclick', (e) => {
        if (e.button === 1) handleNavigation(e);
      });

      return btn;
    }

    function getFeedbackAnchor() {
      const feedbackBtn = document.querySelector(
        '.header-feedback-btn, [class*="header-feedback" i], [aria-label*="feedback" i], [title*="feedback" i]'
      );
      if (feedbackBtn) {
        const r = feedbackBtn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.left >= window.innerWidth * 0.4) {
          return { left: r.left, top: r.top };
        }
      }
      return getRightClusterLeftEdge();
    }

    function getRightClusterLeftEdge() {
      const allElements = document.querySelectorAll(
        '.header-feedback-btn, [class*="header-feedback" i], [aria-label*="feedback" i], [title*="feedback" i], ' +
        'a[class*="gb_"], [aria-label*="Google Account" i], button, [role="button"], a'
      );

      let leftmostX = window.innerWidth;
      let targetTop = 6;
      let found = false;

      for (const el of allElements) {
        if (el.id === BTN_TO_GEMINI_ID || el.closest(`#${BTN_TO_GEMINI_ID}`)) continue;
        const r = el.getBoundingClientRect();
        if (
          r.top >= 0 &&
          r.top <= 40 &&
          r.bottom <= 55 &&
          r.height >= 16 &&
          r.width >= 16 &&
          r.left >= window.innerWidth * 0.4
        ) {
          if (r.left < leftmostX) {
            leftmostX = r.left;
            targetTop = r.top;
            found = true;
          }
        }
      }

      return found ? { left: leftmostX, top: targetTop } : null;
    }

    function isConversationView() {
      const rawHref = window.location.href;
      let decodedHref = rawHref;
      try {
        decodedHref = decodeURIComponent(rawHref);
      } catch (e) {}

      const lowerRaw = rawHref.toLowerCase();
      const lowerDecoded = decodedHref.toLowerCase();

      // 1. Parametri URL tipici di una conversazione attiva in Antigravity:
      if (
        lowerRaw.includes('p=c%2f') ||
        lowerRaw.includes('c%2f') ||
        lowerDecoded.includes('p=c/') ||
        lowerDecoded.includes('/c/') ||
        lowerRaw.includes('section%3d') ||
        lowerDecoded.includes('section=') ||
        lowerRaw.includes('/chat') ||
        lowerRaw.includes('conversation=')
      ) {
        return true;
      }

      // 2. Controllo presenza UUID di conversazione nella query string (?p=c...)
      if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(window.location.search)) {
        return true;
      }

      return false;
    }

    function injectOnAntigravity() {
      if (!isAntigravity) return;

      const cluster = getFeedbackAnchor();
      if (!cluster) return;

      let btn = document.getElementById(BTN_TO_GEMINI_ID);
      if (!btn) {
        btn = createToGeminiButton();
        if (!btn) return;
        document.body.appendChild(btn);
      }

      let effectiveLeft = cluster.left;

      // In conversazione attiva: se innerLayoutLeft è rilevato dall'iframe,
      // ci ancoriamo dinamicamente alla posizione reale del blocco di controlli.
      // Altrimenti usiamo il margine statico di sicurezza di 105px a sinistra di Feedback.
      const CONVERSATION_OFFSET = 105;

      const isConv = hasInnerControls === true || (hasInnerControls === null && isConversationView());

      if (isConv) {
        if (typeof innerLayoutLeft === 'number' && innerLayoutLeft < cluster.left - 20) {
          effectiveLeft = innerLayoutLeft;
        } else {
          effectiveLeft = cluster.left - CONVERSATION_OFFSET;
        }
      } else {
        innerLayoutLeft = null;
      }

      const offsetRight = Math.max(10, Math.round(window.innerWidth - effectiveLeft + 8));
      const targetTop = Math.max(4, Math.round(cluster.top));

      btn.style.setProperty('position', 'fixed', 'important');
      btn.style.setProperty('top', targetTop + 'px', 'important');
      btn.style.setProperty('right', offsetRight + 'px', 'important');
      btn.style.setProperty('left', 'auto', 'important');
      btn.style.setProperty('bottom', 'auto', 'important');
      btn.style.setProperty('z-index', '999999', 'important');
    }

    // --- MAIN CONTROLLER ---
    function runInjection() {
      if (isGemini) {
        injectOnGemini();
      } else if (isAntigravity) {
        injectOnAntigravity();
      }
    }

    setTimeout(runInjection, 50);
    setTimeout(runInjection, 150);
    setTimeout(runInjection, 300);
    setTimeout(runInjection, 600);
    setTimeout(runInjection, 1200);
    setTimeout(runInjection, 2500);

    let debounceTimeout = null;
    const observer = new MutationObserver(() => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        runInjection();
      }, 40);
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    window.addEventListener('resize', runInjection);

    // Monitoraggio transizioni URL in SPA (pushState, replaceState, popstate, hashchange)
    const notifyUrlChange = () => {
      runInjection();
    };

    try {
      const origPushState = history.pushState;
      history.pushState = function(...args) {
        const res = origPushState.apply(this, args);
        notifyUrlChange();
        return res;
      };

      const origReplaceState = history.replaceState;
      history.replaceState = function(...args) {
        const res = origReplaceState.apply(this, args);
        notifyUrlChange();
        return res;
      };
    } catch (e) {}

    window.addEventListener('popstate', notifyUrlChange);
    window.addEventListener('hashchange', notifyUrlChange);

    // Polling leggero ogni 200ms per garantire sincronia URL in qualsiasi router SPA
    let lastHref = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        runInjection();
      }
    }, 200);

    runInjection();
  }
})();
