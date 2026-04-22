function scrapeCertifications() {
  const sec =
    findSectionByIdOrH2("certifications") ||
    findSectionByIdOrH2("licenses_and_certifications") ||
    findSectionByIdOrH2("licenses-and-certifications");
  if (!sec) return [];
  const items = sec.querySelectorAll(
    "li.artdeco-list__item, div.pvs-list__paged-list-item, li.pvs-list__paged-list-item"
  );
  const entries = [];
  for (const item of items) {
    const spans = item.querySelectorAll("span[aria-hidden='true']");
    const texts = Array.from(spans).map((s) => text(s)).filter((t) => t.length > 0);
    if (texts.length === 0) continue;

    const title = texts[0] || "";
    const subtitle = texts.length >= 2 ? texts[1] : "";
    const meta = texts.length >= 3 ? texts[2] : "";

    let credentialId = null;
    let credentialUrl = null;
    if (meta) {
      const idMatch = meta.match(/Credential ID\s+(\S+)/i);
      if (idMatch) credentialId = idMatch[1];
    }
    const credLink = item.querySelector("a[href*='credential']");
    if (credLink) credentialUrl = credLink.href;

    entries.push({
      title,
      subtitle,
      credential_id: credentialId,
      credential_url: credentialUrl,
      meta,
    });
  }
  return entries;
}

function scrapeAvatar() {
  const img =
    document.querySelector("main img.pv-top-card-profile-picture__image") ||
    document.querySelector("main img.profile-photo-edit__preview") ||
    document.querySelector("main .pv-top-card__photo img") ||
    document.querySelector("main img[class*='pv-top-card']") ||
    document.querySelector("main section img[width='200']") ||
    document.querySelector("main button img[class*='profile']") ||
    document.querySelector("img.evi-image.ember-view.profile-photo-edit__preview");
  return img ? img.src : null;
}

function scrapeOpenToWork() {
  const svg = document.querySelector('svg[class*="open-to-work"], img[class*="open-to-work"]');
  if (svg) return true;
  
  // Check avatar alt/title text for #opentowork
  const avatarImgs = document.querySelectorAll("main img.pv-top-card-profile-picture__image, main img.profile-photo-edit__preview, main .pv-top-card__photo img, main img");
  for (const img of avatarImgs) {
    // Normalize: lowercase, strip spaces AND underscores — LinkedIn uses #OPEN_TO_WORK
    const normalize = (s) => (s || "").toLowerCase().replace(/[\s_]+/g, "");
    const alt = normalize(img.alt);
    const title = normalize(img.title);
    if (alt.includes("#opentowork") || title.includes("#opentowork")) return true;
  }

  const spans = document.querySelectorAll("main section span");
  for (const s of spans) {
    const txt = text(s).toLowerCase().replace(/\s+/g, "");
    if (txt === "opentowork" || txt.includes("#opentowork")) return true;
  }
  return false;
}

function scrapeLanguages() {
  const sec = findSectionByIdOrH2("languages");
  if (!sec) return null;
  const items = sec.querySelectorAll("li.artdeco-list__item, div.pvs-list__paged-list-item");
  const entries = [];
  for (const item of items) {
    const spans = item.querySelectorAll("span[aria-hidden='true']");
    const texts = Array.from(spans).map((s) => text(s)).filter((t) => t.length > 0);
    if (texts.length === 0) continue;
    entries.push({
      language: texts[0] || "",
      proficiency: texts.length >= 2 ? texts[1] : null
    });
  }
  return entries.length > 0 ? entries : null;
}

function scrapeProjects() {
  const sec = findSectionByIdOrH2("projects");
  if (!sec) return null;
  const items = sec.querySelectorAll("li.artdeco-list__item, div.pvs-list__paged-list-item");
  const entries = [];
  for (const item of items) {
    const spans = item.querySelectorAll("span[aria-hidden='true']");
    const texts = Array.from(spans).map((s) => text(s)).filter((t) => t.length > 0);
    if (texts.length === 0) continue;
    const descEl = item.querySelector(".inline-show-more-text span[aria-hidden='true'], .inline-show-more-text");
    entries.push({
      title: texts[0] || "",
      date_range: texts.length >= 2 && /[0-9]{4}/.test(texts[1]) ? texts[1] : null,
      description: text(descEl) || ""
    });
  }
  return entries.length > 0 ? entries : null;
}

function scrapeVolunteer() {
  const sec = findSectionByIdOrH2("volunteer");
  if (!sec) return null;
  const items = sec.querySelectorAll("li.artdeco-list__item, div.pvs-list__paged-list-item");
  const entries = [];
  for (const item of items) {
    const spans = item.querySelectorAll("span[aria-hidden='true']");
    const texts = Array.from(spans).map((s) => text(s)).filter((t) => t.length > 0);
    if (texts.length === 0) continue;
    const descEl = item.querySelector(".inline-show-more-text span[aria-hidden='true'], .inline-show-more-text");
    entries.push({
      role: texts[0] || "",
      organization: texts.length >= 2 ? texts[1] : "",
      date_range: texts.length >= 3 ? texts[2] : null,
      description: text(descEl) || ""
    });
  }
  return entries.length > 0 ? entries : null;
}

function scrapeRecommendationsCount() {
  const sec = findSectionByIdOrH2("recommendations");
  if (!sec) return null;
  const h2 = sec.querySelector("h2");
  if (h2) {
    const match = text(h2).match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  const tabs = sec.querySelectorAll("button[id*='recommendation']");
  let total = 0;
  for (const tab of tabs) {
    const m = text(tab).match(/(\d+)/);
    if (m) total += parseInt(m[1], 10);
  }
  return total > 0 ? total : null;
}
