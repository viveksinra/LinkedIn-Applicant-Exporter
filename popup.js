document.addEventListener('DOMContentLoaded', () => {
  const startScrapeBtn = document.getElementById('startScrape');
  const downloadDataBtn = document.getElementById('downloadData');
  const statusDiv = document.getElementById('status');

  startScrapeBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'START_SCRAPE' });
      statusDiv.textContent = 'Scraping...';
    });
  });

  downloadDataBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_DATA' });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_STATUS') {
      statusDiv.textContent = message.text;
    }
  });
}); 