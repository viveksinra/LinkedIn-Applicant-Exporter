// Remove remote import; CSP of MV3 disallows external scripts.
// Instead, export data as CSV (Excel can open CSV files directly).

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_DATA') {
    chrome.storage.local.get('applicants', ({ applicants }) => {
      if (applicants && applicants.length > 0) {
        exportToCSV(applicants);
      } else {
        console.warn('No applicant data to download.');
        chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'No data to export.' });
      }
    });
  }
});

function exportToCSV(applicants) {
  if (!Array.isArray(applicants) || applicants.length === 0) return;

  const headers = Object.keys(applicants[0]);
  const csvRows = [];

  // Header row
  csvRows.push(headers.join(','));

  // Data rows
  for (const applicant of applicants) {
    const row = headers.map(header => sanitizeCSV(applicant[header] ?? ''));
    csvRows.push(row.join(','));
  }

  const csvContent = csvRows.join('\n');

  // Use data URL to avoid blob object URL issues in service worker
  const encoded = encodeURIComponent(csvContent);
  const url = `data:text/csv;charset=utf-8,${encoded}`;

  chrome.downloads.download(
    {
      url,
      filename: 'linkedin_applicants.csv',
      saveAs: true
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError.message);
        chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Download failed.' });
      } else {
        chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Download started.' });
      }
    }
  );
}

function sanitizeCSV(value) {
  if (typeof value !== 'string') value = String(value);
  // Escape quotes by doubling them, and wrap in quotes if value contains comma or newline
  if (value.search(/[",\n]/) !== -1) {
    value = '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
} 