const DEFAULT_URL = 'https://antigravity.google.com';

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ antigravityUrl: DEFAULT_URL }, (data) => {
    document.getElementById('endpoint').value = data.antigravityUrl;
  });
});

document.getElementById('save').addEventListener('click', () => {
  const inputVal = document.getElementById('endpoint').value.trim();
  const urlToSave = inputVal || DEFAULT_URL;

  chrome.storage.sync.set({ antigravityUrl: urlToSave }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Settings saved.';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});
