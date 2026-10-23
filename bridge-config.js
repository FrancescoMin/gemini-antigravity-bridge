/* Shared by the isolated content script and the extension options page. */
var BridgeConfig = (() => {
  const DEFAULT_URL = 'https://antigravity.google.com';
  function isEndpoint(value) {
    try {
      const url = new URL(value);
      if (url.username || url.password) return false;
      const remote = url.hostname === 'antigravity.google.com' || url.hostname.endsWith('.antigravity.google.com');
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      return (remote && url.protocol === 'https:' && !url.port) || (local && url.protocol === 'http:');
    } catch { return false; }
  }
  function endpoint(value) {
    const url = (value || '').trim() || DEFAULT_URL;
    if (!isEndpoint(url)) throw new Error('Use an HTTPS Antigravity URL, or http://localhost / http://127.0.0.1 with an optional port.');
    return new URL(url).href;
  }
  function isRemoteFrame(value) {
    try {
      const url = new URL(value);
      return isEndpoint(value) || (url.origin === 'https://antigravity.static.usercontent.goog' && url.pathname.startsWith('/web/'));
    } catch { return false; }
  }
  return { DEFAULT_URL, isEndpoint, endpoint, isRemoteFrame };
})();
