/**
 * background.js (Service Worker)
 * Handles mock submit, live submit, and mock save API calls.
 */

const DEFAULT_TIMEOUT_MS = 15000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  /* ── Mock submit (original) ──────────────────────────────────── */
  if (message?.type === "MOCK_SUBMIT") {
    const body = message.payload || {};
    sendResponse({
      ok: true,
      status: 200,
      api: {
        message: "Mock API received payload",
        id: "mock-" + Date.now(),
        echoKeys: Object.keys(body),
      },
    });
    return false;
  }

  /* ── Mock save (new — for compare & highlight feature) ───────── */
  if (message?.type === "MOCK_SAVE") {
    const { linkedinId, updates } = message;

    // Simulate network delay
    setTimeout(() => {
      sendResponse({
        ok: true,
        status: 200,
        api: {
          message: "Server record updated successfully (mock)",
          profile_linkedin_id: linkedinId,
          updated_fields: Object.keys(updates || {}),
          updated_values: updates,
          updated_at: new Date().toISOString(),
          mock: true,
        },
      });
    }, 500);

    // Return true to keep sendResponse channel open for async
    return true;
  }

  /* ── Live submit (original) ──────────────────────────────────── */
  if (message?.type === "LIVE_SUBMIT") {
    const { url, method, headers, body, timeoutMs } = message;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);
    fetch(url, {
      method: method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(t);
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text };
        }
        sendResponse({
          ok: res.ok,
          status: res.status,
          api: json,
        });
      })
      .catch((err) => {
        clearTimeout(t);
        const aborted = err?.name === "AbortError";
        sendResponse({
          ok: false,
          status: 0,
          error: aborted ? "Request timed out" : err?.message || String(err),
        });
      });
    return true;
  }

  return false;
});
