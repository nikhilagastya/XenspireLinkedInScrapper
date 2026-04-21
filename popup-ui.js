/**
 * popup-ui.js
 * All DOM rendering functions for the popup.
 * Each function takes data + DOM references, renders into the page.
 */

/* ─── Utility helpers ────────────────────────────────────────────── */

function show(el) {
  el.classList.remove("hidden");
}

function hide(el) {
  el.classList.add("hidden");
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ─── Status Bar ─────────────────────────────────────────────────── */

/**
 * Show a status message in the status bar.
 * @param {"success"|"error"|"info"|"warning"} type
 * @param {string} message
 */
function showStatus(type, message) {
  const bar = document.getElementById("status-bar");
  const icon = document.getElementById("status-icon");
  const text = document.getElementById("status-text");

  bar.className = "status-bar status-" + type;
  show(bar);

  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  icon.textContent = icons[type] || "ℹ️";
  text.textContent = message;
}

function hideStatus() {
  hide(document.getElementById("status-bar"));
}

/* ─── Profile Card ───────────────────────────────────────────────── */

/**
 * Render the profile card section.
 * @param {Object} profile - Profile data in final_profile_json_format
 */
function renderProfileCard(profile) {
  const card = document.getElementById("profile-card");
  const avatarImg = document.getElementById("profile-avatar");
  const avatarPlaceholder = document.getElementById("avatar-placeholder");

  if (profile.avatar) {
    avatarImg.src = profile.avatar;
    show(avatarImg);
    hide(avatarPlaceholder);
  } else {
    hide(avatarImg);
    show(avatarPlaceholder);
  }

  document.getElementById("profile-name").textContent =
    profile.profile_name || "Unknown";
  document.getElementById("profile-title").textContent =
    profile.profile_current_position || "";
  document.getElementById("profile-company").textContent =
    profile.profile_last_experience?.company ||
    profile.profile_experience_full?.[0]?.company ||
    profile.company_id ||
    "";
  document.getElementById("profile-location-text").textContent =
    profile.profile_location || "";

  show(card);
}

/**
 * Show the match badge indicating if the profile exists on the server.
 * @param {boolean} existsOnServer
 */
function renderMatchBadge(existsOnServer) {
  const badge = document.getElementById("match-badge");
  const badgeText = document.getElementById("match-badge-text");

  if (existsOnServer) {
    badge.className = "match-badge match-existing";
    badgeText.textContent = "🟢  Existing Contact — found in database";
  } else {
    badge.className = "match-badge match-new";
    badgeText.textContent = "🔵  New Contact — not in database";
  }
  show(badge);
}

/* ─── Compare & Highlight ────────────────────────────────────────── */

/**
 * Render the compare fields table.
 * @param {Array<CompareResult>} compareResults - From compareProfiles()
 * @returns {void}
 */
function renderCompareFields(compareResults) {
  const container = document.getElementById("compare-fields");
  container.innerHTML = "";

  for (const result of compareResults) {
    const row = document.createElement("div");
    row.className = "compare-row" + (result.isMatch ? "" : " has-diff");
    row.dataset.key = result.key;

    row.innerHTML = `
      <div class="compare-row-header">
        <span class="compare-field-label">${escapeHtml(result.label)}</span>
        <span class="compare-status ${result.isMatch ? "status-match" : "status-diff"}">
          ${result.isMatch ? "✓ Match" : "⚡ Different"}
        </span>
      </div>
      <div class="compare-row-values">
        <div class="compare-value linkedin-value">
          <span class="compare-value-label">LinkedIn (Extracted)</span>
          <input
            type="text"
            class="compare-edit-input"
            data-field-key="${result.key}"
            data-original="${escapeHtml(result.linkedinValue)}"
            data-server="${escapeHtml(result.serverValue)}"
            value="${escapeHtml(result.linkedinValue)}"
          />
        </div>
        <div class="compare-value server-value">
          <span class="compare-value-label">Server</span>
          <span class="compare-server-text">${escapeHtml(result.serverValue)}</span>
        </div>
      </div>
      <div class="compare-save-check ${result.isMatch ? "hidden" : ""}">
        <input type="checkbox" id="save-${result.key}" data-field-key="${result.key}" checked />
        <label for="save-${result.key}">Update server with LinkedIn value</label>
      </div>
    `;

    container.appendChild(row);
  }

  // Attach live edit listeners to all editable inputs
  container.querySelectorAll(".compare-edit-input").forEach((input) => {
    input.addEventListener("input", handleCompareInputChange);
  });

  show(document.getElementById("compare-section"));
  refreshSaveButtonVisibility();
}

/**
 * Handle real-time edits to extracted value inputs.
 * Updates match/diff status and checkbox visibility.
 */
function handleCompareInputChange(e) {
  const input = e.target;
  const fieldKey = input.dataset.fieldKey;
  const serverValue = input.dataset.server;
  const originalValue = input.dataset.original;
  const currentValue = input.value.trim();

  const row = input.closest(".compare-row");
  if (!row) return;

  const statusBadge = row.querySelector(".compare-status");
  const saveCheck = row.querySelector(".compare-save-check");

  // Determine if edited value matches server
  const normalizedCurrent = currentValue.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedServer = (serverValue || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isNowMatch = normalizedCurrent === normalizedServer;

  // Determine if the value was edited from the original scraped value
  const normalizedOriginal = (originalValue || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isEdited = normalizedCurrent !== normalizedOriginal;

  // Update row class
  row.classList.toggle("has-diff", !isNowMatch);
  row.classList.toggle("was-edited", isEdited);

  // Update status badge
  if (isNowMatch) {
    statusBadge.className = "compare-status status-match";
    statusBadge.textContent = "✓ Match";
  } else {
    statusBadge.className = "compare-status status-diff";
    statusBadge.textContent = isEdited ? "✏️ Edited" : "⚡ Different";
  }

  // Toggle edited indicator on input
  input.classList.toggle("is-edited", isEdited);

  // Show/hide checkbox row
  if (isNowMatch) {
    saveCheck.classList.add("hidden");
    const cb = saveCheck.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = false;
  } else {
    saveCheck.classList.remove("hidden");
    const cb = saveCheck.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = true;
  }

  refreshSaveButtonVisibility();
}

/**
 * Show/hide the Save button based on whether any diffs exist.
 */
function refreshSaveButtonVisibility() {
  const hasDiffs = document.querySelectorAll(".compare-row.has-diff").length > 0;
  const saveBtn = document.getElementById("btn-save");
  if (hasDiffs) {
    show(saveBtn);
  } else {
    hide(saveBtn);
  }
}

/**
 * Get the current edited values from all compare input fields.
 * @returns {Object} Map of fieldKey → current edited value
 */
function getEditedCompareValues() {
  const values = {};
  document.querySelectorAll(".compare-edit-input").forEach((input) => {
    values[input.dataset.fieldKey] = input.value.trim();
  });
  return values;
}

/* ─── Accordion Detail Sections ──────────────────────────────────── */

/**
 * Render experience entries into the accordion.
 * @param {Array} experiences - profile_experience_full array
 */
function renderExperience(experiences) {
  const list = document.getElementById("experience-list");
  const countBadge = document.getElementById("exp-count");
  list.innerHTML = "";

  const items = experiences || [];
  countBadge.textContent = items.length;

  if (items.length === 0) {
    list.innerHTML = '<p class="detail-item-meta">No experience data scraped.</p>';
    return;
  }

  for (const exp of items) {
    // If there are nested positions, render each one
    if (exp.positions && exp.positions.length > 0) {
      for (const pos of exp.positions) {
        list.appendChild(
          createDetailItem(
            pos.title || exp.title,
            pos.subtitle || exp.company,
            pos.meta || `${pos.start_date || ""} – ${pos.end_date || ""}`,
            pos.description
          )
        );
      }
    } else {
      list.appendChild(
        createDetailItem(
          exp.title,
          exp.company,
          `${exp.start_date || ""} – ${exp.end_date || ""}${exp.duration ? " · " + exp.duration : ""}`,
          exp.description
        )
      );
    }
  }
}

/**
 * Render education entries into the accordion.
 * @param {Array} education - profile_education_full array
 */
function renderEducation(education) {
  const list = document.getElementById("education-list");
  const countBadge = document.getElementById("edu-count");
  list.innerHTML = "";

  const items = education || [];
  countBadge.textContent = items.length;

  if (items.length === 0) {
    list.innerHTML = '<p class="detail-item-meta">No education data scraped.</p>';
    return;
  }

  for (const edu of items) {
    const subtitle = [edu.degree, edu.field].filter(Boolean).join(", ");
    const meta =
      edu.start_year || edu.end_year
        ? `${edu.start_year || "?"} – ${edu.end_year || "?"}`
        : "";
    list.appendChild(createDetailItem(edu.title, subtitle, meta, null));
  }
}

/**
 * Render certification entries into the accordion.
 * @param {Array} certifications - profile_certifications array
 */
function renderCertifications(certifications) {
  const list = document.getElementById("certs-list");
  const countBadge = document.getElementById("cert-count");
  list.innerHTML = "";

  const items = certifications || [];
  countBadge.textContent = items.length;

  if (items.length === 0) {
    list.innerHTML = '<p class="detail-item-meta">No certifications data scraped.</p>';
    return;
  }

  for (const cert of items) {
    list.appendChild(
      createDetailItem(cert.title, cert.subtitle, cert.meta, null)
    );
  }
}

/**
 * Create a single detail item DOM element.
 */
function createDetailItem(title, subtitle, meta, description) {
  const item = document.createElement("div");
  item.className = "detail-item";
  item.innerHTML = `
    <div class="detail-item-title">${escapeHtml(title || "")}</div>
    ${subtitle ? `<div class="detail-item-subtitle">${escapeHtml(subtitle)}</div>` : ""}
    ${meta ? `<div class="detail-item-meta">${escapeHtml(meta)}</div>` : ""}
    ${description ? `<div class="detail-item-desc">${escapeHtml(description)}</div>` : ""}
  `;
  return item;
}

/* ─── Raw JSON ───────────────────────────────────────────────────── */

/**
 * Render the raw JSON into the collapsible viewer.
 * @param {Object} data - The full profile data
 */
function renderRawJson(data) {
  document.getElementById("json-raw").textContent = JSON.stringify(data, null, 2);
  show(document.getElementById("json-section"));
}

/* ─── Accordion Toggle Setup ─────────────────────────────────────── */

/**
 * Initialize all accordion toggle buttons.
 * Call once on DOMContentLoaded.
 */
function initAccordions() {
  const triggers = document.querySelectorAll(".accordion-trigger");
  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      const targetId = trigger.dataset.target;
      const body = document.getElementById(targetId);
      if (!body) return;

      const isOpen = !body.classList.contains("collapsed");
      body.classList.toggle("collapsed", isOpen);
      trigger.classList.toggle("open", !isOpen);
    });
  }
}

/* ─── Full Render Pipeline ───────────────────────────────────────── */

/**
 * Render the entire popup UI after a successful capture.
 * @param {Object} profile        - Scraped profile in final format
 * @param {Object|null} serverRec - Server record (null if new contact)
 * @param {Array} compareResults  - From compareProfiles()
 */
function renderCapturedProfile(profile, serverRec, compareResults) {
  // Hide empty state
  hide(document.getElementById("empty-state"));

  // Profile card
  renderProfileCard(profile);
  renderMatchBadge(!!serverRec);

  // Compare section
  if (serverRec) {
    renderCompareFields(compareResults);
  } else {
    hide(document.getElementById("compare-section"));
  }

  // Detail sections
  renderExperience(profile.profile_experience_full);
  renderEducation(profile.profile_education_full);
  renderCertifications(profile.profile_certifications);
  show(document.getElementById("details-section"));

  // Raw JSON
  renderRawJson(profile);
}

/**
 * Get the currently selected field keys (checked checkboxes in the compare section).
 * @returns {Array<string>}
 */
function getSelectedUpdateKeys() {
  const checkboxes = document.querySelectorAll(
    '.compare-save-check input[type="checkbox"]:checked'
  );
  return Array.from(checkboxes).map((cb) => cb.dataset.fieldKey);
}
