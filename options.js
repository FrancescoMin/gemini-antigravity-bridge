document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ antigravityUrl: BridgeConfig.DEFAULT_URL }, data => {
    document.getElementById('endpoint').value = data.antigravityUrl;
  });
});
let statusTimer;
document.getElementById('save').addEventListener('click', () => {
  const status = document.getElementById('status');
  clearTimeout(statusTimer);
  let antigravityUrl;
  try {
    antigravityUrl = BridgeConfig.endpoint(document.getElementById('endpoint').value);
  } catch (error) {
    status.style.color = '#b3261e';
    status.textContent = error.message;
    return;
  }
  chrome.storage.sync.set({ antigravityUrl }, () => {
    if (chrome.runtime.lastError) {
      status.style.color = '#b3261e';
      status.textContent = chrome.runtime.lastError.message;
      return;
    }
    status.style.color = '#137333';
    status.textContent = 'Settings saved.';
    statusTimer = setTimeout(() => { status.textContent = ''; }, 2000);
  });
});
