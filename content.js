chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SCRAPE') {
    scrapeCurrentApplicant();
  }
});

async function scrapeCurrentApplicant() {
  chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Scraping current applicant...' });

  const rightPanel = document.querySelector('main.hiring-applicants__right-column');
  if (!rightPanel) {
    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Error: Applicant details panel not found.' });
    console.log('Scraper Error: Could not find right panel with selector "main.hiring-applicants__right-column"');
    return;
  }

  const nameElement = rightPanel.querySelector('h1.t-24');
  const name = nameElement ? nameElement.innerText.split('’')[0].trim() : 'N/A';
  
  const infoElements = rightPanel.querySelectorAll('.t-16');
  const headline = infoElements[0] ? infoElements[0].innerText.trim() : '';
  const location = infoElements[1] ? infoElements[1].innerText.trim() : '';

  chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: `Processing ${name}. Finding "More..." button.` });
  
  let moreButton;
  try {
    // Wait for the "More" button to be available
    await waitFor(() => {
        const panel = document.querySelector('main.hiring-applicants__right-column');
        if (!panel) return false;
        // Use textContent for broader matching and trim whitespace. The text is "More..."
        moreButton = Array.from(panel.querySelectorAll('button')).find(
          btn => btn.textContent && btn.textContent.trim().startsWith('More')
        );
        return moreButton;
      },
      5000, 250
    );
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Error: "More..." button not found.' });
    console.log(`Scraper Error: Could not find "More..." button for ${name}.`);
    return;
  }

  console.log('Scraper: Found "More..." button, clicking it.', moreButton);
  chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Clicking "More..." button...' });
  moreButton.click();

  let dropdownContent;
  try {
    await waitFor(
      () => document.querySelector('.artdeco-dropdown__content:not([aria-hidden="true"])'),
      5000, 250
    );
    dropdownContent = document.querySelector('.artdeco-dropdown__content:not([aria-hidden="true"])');
    console.log('Scraper: Found dropdown content.', dropdownContent);
    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Extracting contact info...' });

  } catch (e) {
    chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: 'Error: Could not find contact info dropdown.' });
    console.log(`Scraper Error: Timed out waiting for dropdown for ${name}.`);
    document.body.click(); // Attempt to close any lingering popups
    return;
  }

  let email = '', phone = '';
  
  if (dropdownContent) {
    // Use a more robust way to get all text within the dropdown
    const allText = Array.from(dropdownContent.querySelectorAll('span, div'))
                        .map(el => el.textContent.trim())
                        .join('\n');

    const emailMatch = allText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    email = emailMatch ? emailMatch[0] : '';

    // This regex is broad to capture various phone formats
    const phoneMatch = allText.match(/(\+?\d[\d\s\-\(\)]{8,}\d)/);
    phone = phoneMatch ? phoneMatch[0] : '';
    
    console.log(`Scraper: Extracted Email: "${email}", Phone: "${phone}"`);
  }

  // Click outside to close the dropdown before the next action
  document.body.click();
  await sleep(300); // Give it a moment to close

  if (!email && !phone) {
      chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: `No contact info found for ${name}.` });
      console.log(`Scraper: No contact info found for ${name}.`);
      return;
  }

  const applicantData = { name, headline, location, email, phone };
  
  chrome.storage.local.get({ applicants: [] }, ({ applicants }) => {
    // Check for duplicates
    if (applicants.some(a => a.name === applicantData.name && a.email === applicantData.email && a.phone === applicantData.phone)) {
        chrome.runtime.sendMessage({ type: 'UPDATE_STATUS', text: `${name} is already saved.` });
        console.log(`Scraper: ${name} is a duplicate, not saving.`);
        return;
    }
    
    const updatedApplicants = [...applicants, applicantData];
    chrome.storage.local.set({ applicants: updatedApplicants }, () => {
      chrome.runtime.sendMessage({
        type: 'UPDATE_STATUS',
        text: `Success! Scraped ${name}. Total: ${updatedApplicants.length}.`
      });
      console.log(`Scraper: Successfully saved ${name}. Total now ${updatedApplicants.length}.`);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitFor(condition, timeout, interval) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
} 