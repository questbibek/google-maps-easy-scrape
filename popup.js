document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        const actionButton = document.getElementById('actionButton');
        const downloadCsvButton = document.getElementById('downloadCsvButton');
        const resultsTable = document.getElementById('resultsTable');
        const filenameInput = document.getElementById('filenameInput');
        const searchForm = document.getElementById('searchForm');
        const searchTermInput = document.getElementById('searchTermInput');
        const locationsInput = document.getElementById('locationsInput');
        const progressInfo = document.getElementById('progressInfo');
        
        let allResults = [];

        if (currentTab && currentTab.url.includes("://www.google.com/maps")) {
            document.getElementById('message').textContent = "Let's scrape Google Maps!";
            searchForm.style.display = 'block';
            actionButton.disabled = false;
            actionButton.classList.add('enabled');
        } else {
            const messageElement = document.getElementById('message');
            messageElement.innerHTML = '';
            const linkElement = document.createElement('a');
            linkElement.href = 'https://www.google.com/maps/';
            linkElement.textContent = "Go to Google Maps.";
            linkElement.target = '_blank';
            messageElement.appendChild(linkElement);

            actionButton.style.display = 'none';
            downloadCsvButton.style.display = 'none';
            filenameInput.style.display = 'none';
            searchForm.style.display = 'none';
        }

        actionButton.addEventListener('click', async function () {
            const searchTerm = searchTermInput.value.trim();
            const locationsText = locationsInput.value.trim();

            if (!searchTerm) {
                alert('Please enter a search term!');
                return;
            }

            if (!locationsText) {
                alert('Please enter at least one location!');
                return;
            }

            // Parse locations (comma-separated)
            const locations = locationsText.split(',').map(loc => loc.trim()).filter(loc => loc);

            if (locations.length === 0) {
                alert('Please enter valid locations!');
                return;
            }

            // Disable inputs during scraping
            actionButton.disabled = true;
            searchTermInput.disabled = true;
            locationsInput.disabled = true;
            actionButton.textContent = 'Scraping...';
            allResults = [];
            
            // Clear existing table
            while (resultsTable.firstChild) {
                resultsTable.removeChild(resultsTable.firstChild);
            }

            // Add headers
            const headers = ['Location', 'Title', 'Rating', 'Reviews', 'Phone', 'Website', 'Address', 'Google Maps Link'];
            const headerRow = document.createElement('tr');
            headers.forEach(headerText => {
                const header = document.createElement('th');
                header.textContent = headerText;
                headerRow.appendChild(header);
            });
            resultsTable.appendChild(headerRow);

            // Scrape each location
            for (let i = 0; i < locations.length; i++) {
                const location = locations[i];
                progressInfo.style.display = 'block';
                progressInfo.textContent = `Scraping ${i + 1}/${locations.length}: ${searchTerm} in ${location}...`;

                try {
                    // Perform search for this location
                    const searchQuery = `${searchTerm} in ${location}`;
                    await performSearch(currentTab.id, searchQuery);

                    // Wait for results to load
                    await new Promise(r => setTimeout(r, 3000));

                    // Scrape the results
                    const results = await scrapeCurrentPage(currentTab.id);

                    // Add location to each result
                    results.forEach(result => {
                        result.location = location;
                        allResults.push(result);
                    });

                    // Update table with new results
                    updateTable(results, location);

                    console.log(`Scraped ${results.length} results from ${location}`);

                } catch (error) {
                    console.error(`Error scraping ${location}:`, error);
                    progressInfo.textContent = `Error scraping ${location}: ${error.message}`;
                }

                // Delay between locations
                if (i < locations.length - 1) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            // Re-enable inputs
            actionButton.disabled = false;
            searchTermInput.disabled = false;
            locationsInput.disabled = false;
            actionButton.textContent = 'Start Scraping';
            progressInfo.textContent = `✓ Complete! Scraped ${allResults.length} total results from ${locations.length} location(s)`;

            if (allResults.length > 0) {
                downloadCsvButton.disabled = false;
                
                // AUTO EXPORT CSV
                const csv = tableToCsv(resultsTable);
                let filename = filenameInput.value.trim();
                if (!filename) {
                    const now = new Date();
                    const timestamp = now.getFullYear() + 
                                    String(now.getMonth() + 1).padStart(2, '0') + 
                                    String(now.getDate()).padStart(2, '0') + '_' +
                                    String(now.getHours()).padStart(2, '0') + 
                                    String(now.getMinutes()).padStart(2, '0');
                    filename = `google-maps-${searchTerm.replace(/\s+/g, '-')}_${timestamp}.csv`;
                } else {
                    filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.csv';
                }
                downloadCsv(csv, filename);
                
                alert(`Successfully scraped ${allResults.length} results!\nCSV downloaded as: ${filename}`);
            }
        });

        downloadCsvButton.addEventListener('click', function () {
            const csv = tableToCsv(resultsTable);
            let filename = filenameInput.value.trim();
            if (!filename) {
                const now = new Date();
                const timestamp = now.getFullYear() + 
                                String(now.getMonth() + 1).padStart(2, '0') + 
                                String(now.getDate()).padStart(2, '0') + '_' +
                                String(now.getHours()).padStart(2, '0') + 
                                String(now.getMinutes()).padStart(2, '0');
                filename = `google-maps-data_${timestamp}.csv`;
            } else {
                filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.csv';
            }
            downloadCsv(csv, filename);
        });

        function updateTable(results, location) {
            results.forEach(function (item) {
                const row = document.createElement('tr');
                ['location', 'title', 'rating', 'reviewCount', 'phone', 'website', 'address', 'href'].forEach(function (key) {
                    const cell = document.createElement('td');
                    cell.textContent = item[key] || '';
                    row.appendChild(cell);
                });
                resultsTable.appendChild(row);
            });
        }

        async function performSearch(tabId, searchQuery) {
            return chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: (query) => {
                    // Find the search input
                    const searchInput = document.querySelector('input.UGojuc');
                    if (searchInput) {
                        searchInput.value = query;
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        // Trigger search
                        const searchButton = document.querySelector('button.mL3xi');
                        if (searchButton) {
                            searchButton.click();
                        } else {
                            // Alternative: submit the form
                            const form = document.querySelector('form.NhWQq');
                            if (form) {
                                form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                            }
                        }
                    }
                },
                args: [searchQuery]
            });
        }

        async function scrapeCurrentPage(tabId) {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: scrapeDataWithDetailedView,
            });

            if (results && results[0] && results[0].result) {
                return results[0].result;
            }
            return [];
        }
    });
});

function scrapeDataWithDetailedView() {
    return new Promise(async (resolve) => {
        console.log('=== SCRAPING STARTED ===');
        const results = [];
        
        const resultsPane = document.querySelector('[role="feed"]');
        
        if (!resultsPane) {
            console.error('Results pane not found');
            resolve([]);
            return;
        }

        console.log('Scrolling to load all results...');
        await scrollToLoadAll(resultsPane);
        
        const links = Array.from(document.querySelectorAll('a.hfpxzc'));
        console.log(`Found ${links.length} results`);
        
        if (links.length === 0) {
            console.error('No result links found');
            resolve([]);
            return;
        }
        
        const maxResults = Math.min(links.length, 50);
        
        for (let i = 0; i < maxResults; i++) {
            try {
                console.log(`Scraping ${i + 1}/${maxResults}...`);
                
                links[i].click();
                await new Promise(r => setTimeout(r, 2500));
                
                const data = extractDetailPanelData();
                data.href = links[i].href;
                
                console.log('Extracted:', data.title, '- Reviews:', data.reviewCount);
                results.push(data);
                
                await new Promise(r => setTimeout(r, 300));
                
            } catch (error) {
                console.error(`Error at ${i + 1}:`, error);
                results.push({
                    title: 'Error',
                    rating: '',
                    reviewCount: '',
                    phone: '',
                    website: '',
                    address: '',
                    href: links[i]?.href || ''
                });
            }
        }
        
        console.log(`=== COMPLETE: ${results.length} results ===`);
        resolve(results);
    });

    async function scrollToLoadAll(resultsPane) {
        let previousHeight = resultsPane.scrollHeight;
        let attempts = 0;
        const maxScrolls = 30;

        for (let i = 0; i < maxScrolls; i++) {
            resultsPane.scrollTo(0, resultsPane.scrollHeight);
            await new Promise(r => setTimeout(r, 1500));

            const newHeight = resultsPane.scrollHeight;
            
            if (newHeight === previousHeight) {
                attempts++;
                if (attempts >= 3) break;
            } else {
                attempts = 0;
            }
            previousHeight = newHeight;

            const endMessage = document.querySelector('[role="heading"][aria-level="3"]');
            if (endMessage?.textContent.includes("You've reached the end")) {
                console.log('Reached end');
                break;
            }
        }
    }

    function extractDetailPanelData() {
        const data = {
            title: '',
            rating: '',
            reviewCount: '',
            phone: '',
            website: '',
            address: ''
        };

        try {
            const titleEl = document.querySelector('.DUwDvf');
            data.title = titleEl?.textContent?.trim() || '';

            const ratingDisplayEl = document.querySelector('.fontDisplayLarge');
            data.rating = ratingDisplayEl?.textContent?.trim() || '';
            
            if (!data.rating) {
                const ratingEl = document.querySelector('.F7nice span[aria-hidden="true"]');
                data.rating = ratingEl?.textContent?.trim() || '';
            }
            
            const reviewButtonEl = document.querySelector('button.GQjSyb .HHrUdb span');
            if (reviewButtonEl) {
                const reviewText = reviewButtonEl.textContent?.trim() || '';
                const match = reviewText.match(/(\d+)\s+review/i);
                data.reviewCount = match ? match[1] : '';
            }
            
            if (!data.reviewCount) {
                const reviewEl = document.querySelector('.F7nice span[role="img"]');
                if (reviewEl) {
                    const ariaLabel = reviewEl.getAttribute('aria-label');
                    const match = ariaLabel?.match(/(\d+)\s+review/i);
                    data.reviewCount = match ? match[1] : '';
                }
            }

            const phoneBtn = document.querySelector('[data-item-id*="phone"]');
            if (phoneBtn) {
                const ariaLabel = phoneBtn.getAttribute('aria-label');
                data.phone = ariaLabel?.replace(/^Phone:\s*/i, '').trim() || '';
                
                if (!data.phone) {
                    const phoneText = phoneBtn.querySelector('.Io6YTe');
                    data.phone = phoneText?.textContent?.trim() || '';
                }
            }

            const websiteLink = document.querySelector('a[data-item-id*="authority"]');
            if (websiteLink) {
                data.website = websiteLink.textContent?.trim() || websiteLink.href || '';
            }

            const addressBtn = document.querySelector('[data-item-id="address"]');
            if (addressBtn) {
                const addressText = addressBtn.querySelector('.Io6YTe');
                data.address = addressText?.textContent?.trim() || '';
            }

        } catch (error) {
            console.error('Extraction error:', error);
        }

        return data;
    }
}

function tableToCsv(table) {
    const csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const rowData = Array.from(cols).map(col => {
            const text = col.textContent.replace(/"/g, '""');
            return `"${text}"`;
        });
        csv.push(rowData.join(','));
    });

    return csv.join('\n');
}

function downloadCsv(csv, filename) {
    const csvFile = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}