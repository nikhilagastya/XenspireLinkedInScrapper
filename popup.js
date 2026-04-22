/**
 * popup.js
 * Main orchestrator — wires up event handlers and coordinates
 * between content script extraction, comparison logic, and UI rendering.
 *
 * Dependencies (loaded via <script> in popup.html):
 *   - mock-server-data.js   → getServerRecord()
 *   - popup-compare.js      → compareProfiles(), buildUpdatePayload(), hasDifferences()
 *   - popup-ui.js           → renderCapturedProfile(), showStatus(), etc.
 */

/* ─── State ──────────────────────────────────────────────────────── */

/** Currently captured profile (in final_profile_json_format) */
let currentProfile = null;

/** Currently matched server record (or null for new contacts) */
let currentServerRecord = null;

/* ─── Chrome helpers ─────────────────────────────────────────────── */

function getActiveTab() {
  return chrome.tabs
    .query({ active: true, currentWindow: true })
    .then((tabs) => tabs[0] || null);
}

function isNoReceiverError(err) {
  const msg = err?.message || String(err);
  return (
    msg.includes("Receiving end does not exist") ||
    msg.includes("Could not establish connection")
  );
}

/**
 * Send extraction message to the content script.
 * If the content script isn't injected yet, inject it first.
 */
async function sendExtractProfile(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PROFILE" });
  } catch (e) {
    if (!isNoReceiverError(e)) throw e;
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "functions/helpers.js",
        "functions/experience.js",
        "functions/education.js",
        "functions/company.js",
        "functions/activity.js",
        "functions/connections.js",
        "functions/misc-scrapers.js",
        "content.js"
      ],
    });
    return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PROFILE" });
  }
}

/* ─── Capture Flow ───────────────────────────────────────────────── */

async function handleCapture() {
  const btnCapture = document.getElementById("btn-capture");
  btnCapture.disabled = true;
  btnCapture.classList.add("loading");
  showStatus("info", "Capturing profile from active tab…");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      showStatus("error", "No active tab found.");
      return;
    }

    const res = await sendExtractProfile(tab.id);

    if (!res?.ok) {
      showStatus("error", res?.error || "Extraction failed.");
      return;
    }

    const { profile, meta } = res.data;

    if (!profile) {
      showStatus("error", "No profile data returned. " + (meta?.warnings?.join("; ") || ""));
      return;
    }

    // Store in state
    currentProfile = profile;

    // Warnings
    if (meta?.warnings?.length > 0) {
      showStatus("warning", meta.warnings.join(" · "));
    } else {
      const time = new Date(meta?.capturedAt || Date.now()).toLocaleTimeString();
      showStatus("success", `Profile captured at ${time}`);
    }

    // Look up server record
    const linkedinId = profile.profile_linkedin_id;
    currentServerRecord = getServerRecord(linkedinId, profile);

    // Compare
    let compareResults = [];
    if (currentServerRecord) {
      compareResults = compareProfiles(profile, currentServerRecord);
    }

    // Render everything
    renderCapturedProfile(profile, currentServerRecord, compareResults);
  } catch (e) {
    showStatus(
      "error",
      e?.message ||
        "Failed. Ensure you're on a LinkedIn profile page and try again."
    );
  } finally {
    btnCapture.disabled = false;
    btnCapture.classList.remove("loading");
  }
}

/* ─── Save Flow ──────────────────────────────────────────────────── */

async function handleSave() {
  const btnSave = document.getElementById("btn-save");

  if (!currentProfile || !currentServerRecord) {
    showStatus("error", "No profile or server record to update.");
    return;
  }

  const selectedKeys = getSelectedUpdateKeys();

  if (selectedKeys.length === 0) {
    showStatus("warning", "No fields selected to update.");
    return;
  }

  const updatePayload = buildUpdatePayload(selectedKeys, currentProfile, getEditedCompareValues());

  btnSave.disabled = true;
  showStatus("info", "Saving to server…");

  try {
    const res = await chrome.runtime.sendMessage({
      type: "MOCK_SAVE",
      linkedinId: currentProfile.profile_linkedin_id,
      updates: updatePayload,
    });

    if (res?.ok) {
      showStatus(
        "success",
        `Saved ${selectedKeys.length} field(s): ${selectedKeys.join(", ")}`
      );
    } else {
      showStatus("error", res?.error || "Save failed.");
    }
  } catch (e) {
    showStatus("error", e?.message || "Save request failed.");
  } finally {
    btnSave.disabled = false;
  }
}

/* ─── Init ───────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  // Accordion setup
  initAccordions();

  // Capture button
  document.getElementById("btn-capture").addEventListener("click", handleCapture);

  // Save button
  document.getElementById("btn-save").addEventListener("click", handleSave);
});
