# Xenspire LinkedIn Scraper

A Google Chrome Extension that captures and extracts data from LinkedIn profiles directly from your browser. 

## How to Install (Load Unpacked)

To use this extension, you'll need to load it directly into Chrome:

1. **Clone or Download the Repository**
   - Open your terminal and run the following command:
     ```bash
     git clone https://github.com/nikhilagastya/XenspireLinkedInScrapper.git
     ```
   - Alternatively, you can click "Code" -> "Download ZIP" on GitHub and extract the folder.

2. **Open Chrome Extensions Page**
   - Open Google Chrome and type `chrome://extensions/` in the address bar.
   - Hit Enter.

3. **Enable Developer Mode**
   - In the top right corner of the Extensions page, toggle on **Developer mode**.

4. **Load the Extension**
   - Click the **Load unpacked** button that appears in the top left.
   - Select the `XenspireLinkedInScrapper` folder you cloned or extracted.

5. **Pin the Extension (Optional)**
   - Click the puzzle piece icon next to your Chrome profile picture.
   - Click the pin icon next to "Xenspire — Profile Capture" to keep it visible.

## How to Use

1. Navigate to any LinkedIn Profile page (e.g., `https://www.linkedin.com/in/some-profile/`).
2. Wait for the page to fully load.
3. Click the Xenspire extension icon in your Chrome toolbar.
4. Click the **Capture Profile** button.
5. The extension will scrape the profile data, compare it against the mock server, and allow you to view, edit, and save the data.

## Project Structure

This project uses Vanilla JavaScript and Chrome Manifest V3.

| Folder / File | Role |
|------|------|
| `manifest.json` | Extension configuration and permissions |
| `background.js` | Service worker for backend communication |
| `popup.html` | The user interface of the extension |
| `popup-ui.js` | Handles DOM manipulation and UI rendering |
| `popup-compare.js` | Logic for comparing extracted data vs server data |
| `popup.js` | Extension popup orchestrator |
| `content.js` | Main entry point for the DOM scraper |
| `functions/` | Modular scraping functions injected into the page |

## Troubleshooting

- **No Active Tab Found:** Make sure you are currently on a valid LinkedIn profile page before clicking "Capture Profile".
- **Debugging:** If something goes wrong, you can right-click anywhere in the extension popup and click **Inspect** to open the developer tools and view console errors.
