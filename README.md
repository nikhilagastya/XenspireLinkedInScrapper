# Profile Capture — Chrome extension prototype (MV3)

Minimal unpacked extension to verify: **content script extraction → popup review/edit → service worker POST (mock or live)**.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder: `chrome-extension-prototype`.

## Try it (recommended: localhost fixture)

1. In a terminal:

   ```bash
   cd chrome-extension-prototype
   python3 -m http.server 8765
   ```

2. In Chrome, open: `http://localhost:8765/fixture/profile-mock.html`
3. Click the extension icon → **Capture from tab** → edit JSON if you like → **Submit (mock)**.
4. For a real endpoint, enter **Live POST URL**, optional **Bearer token**, then **Submit (live)**.  
   Your server must allow requests from the extension (CORS / allowed origins for browser extensions).

## LinkedIn

With a profile tab on `https://www.linkedin.com/...`, **Capture** uses best-effort selectors; markup changes often, so use the fixture for stable demos.

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest, host permissions |
| `content.js` | DOM extraction, responds to `EXTRACT_PROFILE` |
| `background.js` | Mock submit + `fetch` for live submit |
| `popup.html` / `popup.js` / `popup.css` | UI and messaging |

## Logging

Use **Inspect views: service worker** / **popup** under the extension card on `chrome://extensions` for `console.log` while iterating.
