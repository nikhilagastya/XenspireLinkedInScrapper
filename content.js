/**
 * Content script: LinkedIn profile DOM scraper.
 * Outputs data in the final_profile_json_format schema.
 *
 * LinkedIn markup changes often; use fixture/profile-mock.html on localhost
 * for a stable demo.
 */

/* ─── helpers ────────────────────────────────────────────────────────── */

function text(el) {
  return el && el.textContent ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Extract LinkedIn ID from the current URL, e.g. "amanda-dennis-842265103" */
function extractLinkedInId() {
  const m = window.location.pathname.match(/\/in\/([^/?#]+)/);
  return m ? m[1] : null;
}

/* ─── section finders ────────────────────────────────────────────────── */

function findSectionByIdOrH2(id) {
  const byId = document.querySelector("#" + id);
  if (byId) {
    const sec = byId.closest("section");
    if (sec) return sec;
  }
  const cards = document.querySelectorAll("main section.artdeco-card");
  const regex = new RegExp("^" + id + "\\b", "i");
  for (const sec of cards) {
    const h2 = sec.querySelector("h2");
    const ht = text(h2);
    if (h2 && regex.test(ht) && ht.length < 40) return sec;
  }
  return null;
}

/* ─── headline / company helpers ─────────────────────────────────────── */

/**
 * Extract company name from LinkedIn headline.
 * Handles patterns like:
 *   "Role at Company"         → Company
 *   "Role | Company"          → Company
 *   "Role @Company || Ex @X"  → Company (first @mention)
 *   "Role · Company"          → Company
 */
function companyFromHeadline(headline) {
  if (!headline) return "";
  let h = headline.replace(/\s+/g, " ").trim();

  // Pattern: "Role at Company" (but not "@Company")
  const atMatch = h.match(/(?:^|\s)at\s+([^·|@]+?)(?:\s*[|·]|$)/i);
  if (atMatch) return atMatch[1].trim();

  // Pattern: "@Company" — take the FIRST @mention as current company
  const atMentionMatch = h.match(/@([\w][\w\s&.-]{0,60}?)(?:\s*\|\||\s*·|$)/i);
  if (atMentionMatch) return atMentionMatch[1].trim();

  // Pattern: "Role | Company" or "Role || Company" — take first segment after separator
  const pipeParts = h.split(/\|\||[|·]/).map((p) => p.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    // The first part is usually the role, second is usually the company
    for (let i = 1; i < pipeParts.length; i++) {
      const part = pipeParts[i];
      // Skip parts that look like "Ex @X" or are too short
      if (part.length > 1 && part.length < 120 && !/^(ex|former|prev)\b/i.test(part)) {
        return part;
      }
    }
  }

  return "";
}

function linkedInCompanyFromExperience() {
  const sec = findSectionByIdOrH2("experience");
  if (!sec) return "";
  const item =
    sec.querySelector("li.artdeco-list__item") ||
    sec.querySelector("div.pvs-list__paged-list-item") ||
    sec.querySelector("li") ||
    sec.querySelector("div[class*='pvs-list']");
  if (!item) return "";
  const ariaSpans = item.querySelectorAll("span[aria-hidden='true']");
  const candidates = [];
  for (const s of ariaSpans) {
    const t = text(s);
    if (t && t.length > 1 && t.length < 120) candidates.push(t);
  }
  if (candidates.length >= 2) return candidates[1];
  if (candidates.length === 1) {
    const t = candidates[0];
    if (!/\d{4}|yr|mos|mos\b|present|full-?time|part-?time|contract/i.test(t)) return t;
  }
  const bold = item.querySelector("span.t-bold, span[class*='t-bold']");
  const sub = item.querySelector("span.t-normal, span[class*='t-normal']");
  const b = text(bold);
  const n = text(sub);
  if (n && n !== b && n.length < 120) return n;
  return "";
}

/* ─── intelligent scraper helpers ────────────────────────────────────── */

function calculateExperienceYears(experiences) {
  if (!experiences || experiences.length === 0) return null;
  let minYear = 9999;
  for (const exp of experiences) {
    if (exp.start_date) {
      const match = exp.start_date.match(/\d{4}/);
      if (match) {
        const year = parseInt(match[0], 10);
        if (year < minYear) minYear = year;
      }
    }
  }
  if (minYear === 9999) return null;
  const currentYear = new Date().getFullYear();
  const years = currentYear - minYear;
  return years > 0 ? years : null;
}

const COUNTRY_MAP = {
  "india": "IN", "united states": "US", "usa": "US", "united kingdom": "GB", "uk": "GB",
  "canada": "CA", "australia": "AU", "germany": "DE", "france": "FR", "singapore": "SG",
  "uae": "AE", "united arab emirates": "AE", "netherlands": "NL", "brazil": "BR", "spain": "ES",
  "italy": "IT", "sweden": "SE", "switzerland": "CH", "japan": "JP", "china": "CN"
};

function determineCountryCode(location) {
  if (!location) return null;
  const parts = location.split(",").map(p => p.trim().toLowerCase());
  const lastPart = parts[parts.length - 1];
  return COUNTRY_MAP[lastPart] || null;
}

/* ─── experience scraper ─────────────────────────────────────────────── */

/** Detect if a string looks like a duration: "2 yrs 5 mos", "3 mos", etc. */
function isDurationString(s) {
  return /^\d+\s*(yr|yrs|mo|mos|year|month)/.test(s.trim());
}

/** Detect if a string looks like a date range: "Feb 2026 - Present · 3 mos" */
function isDateRange(s) {
  return /[A-Za-z]+\s+\d{4}\s*[-–]/.test(s) || /^\d{4}\s*[-–]/.test(s);
}

/** Parse dates and duration from a meta string like "Feb 2026 - Present · 3 mos" */
function parseDateMeta(meta) {
  let startDate = "";
  let endDate = "";
  let duration = "";
  if (!meta) return { startDate, endDate, duration };

  const dateMatch = meta.match(
    /([A-Za-z]+\s+\d{4})\s*[-–]\s*(Present|[A-Za-z]+\s+\d{4})/i
  );
  if (dateMatch) {
    startDate = dateMatch[1];
    endDate = dateMatch[2];
  }
  const durMatch = meta.match(/·\s*(.+)$/);
  if (durMatch) duration = durMatch[1].trim();
  // Also handle standalone duration like "2 yrs 5 mos"
  if (!duration && isDurationString(meta)) duration = meta.trim();

  return { startDate, endDate, duration };
}

/** Clean company name — strip " · Full-time", " · Internship", etc. */
function cleanCompanyName(raw) {
  return (raw || "")
    .replace(/\s*·\s*(Full-time|Part-time|Contract|Internship|Freelance|Self-employed|Seasonal|Apprenticeship)$/i, "")
    .trim();
}

function scrapeExperience() {
  const sec = findSectionByIdOrH2("experience");
  if (!sec) return [];

  // Find all potential items
  const allItems = Array.from(sec.querySelectorAll(
    "li.artdeco-list__item, div.pvs-list__paged-list-item, li.pvs-list__paged-list-item"
  ));
  
  // Filter out nested items to get only the top-level company blocks
  const items = allItems.filter(item => {
    let parent = item.parentElement;
    while (parent && parent !== sec) {
      if (parent.matches("li.artdeco-list__item, div.pvs-list__paged-list-item, li.pvs-list__paged-list-item")) {
        return false; // It's a nested role, skip it here
      }
      parent = parent.parentElement;
    }
    return true; // It's a top-level company block
  });

  const entries = [];

  for (const item of items) {
    // Find nested items for this company block
    const nestedItems = Array.from(item.querySelectorAll(
      "li.artdeco-list__item, div.pvs-list__paged-list-item, li.pvs-list__paged-list-item"
    ));

    const companyLink = item.querySelector("a[href*='/company/']");
    const companyUrl = companyLink ? companyLink.href : "";
    const logoImg = item.querySelector("img");
    const logoUrl = logoImg ? logoImg.src : null;

    if (nestedItems.length > 0) {
      // Grouped role: Separate header spans from nested role spans
      const headerSpans = Array.from(item.querySelectorAll("span[aria-hidden='true']"))
        .filter(span => !nestedItems.some(ni => ni.contains(span)));
        
      const headerTexts = headerSpans.map(s => text(s)).filter(Boolean);

      const companyTitle = headerTexts[0] || "";
      const totalDuration =
        headerTexts.length > 1 && isDurationString(headerTexts[1])
          ? headerTexts[1]
          : "";

      const positions = [];

      for (const roleItem of nestedItems) {
        const roleSpans = roleItem.querySelectorAll("span[aria-hidden='true']");
        const rTexts = Array.from(roleSpans).map((s) => text(s)).filter(Boolean);
        if (rTexts.length === 0) continue;

        const roleTitle = rTexts[0] || "";

        // Find the date meta: look for the first string that resembles dates
        let meta = "";
        let loc = "";
        for (let i = 1; i < Math.min(rTexts.length, 5); i++) {
          if (isDateRange(rTexts[i]) || /\b(19|20)\d{2}\b/.test(rTexts[i])) {
            meta = rTexts[i];
            loc = rTexts[i + 1] || "";
            break;
          }
        }
        if (!meta) {
          meta = rTexts[1] || "";
          loc = rTexts[2] || "";
        }

        const parsed = parseDateMeta(meta);
        positions.push({
          title: roleTitle,
          subtitle: cleanCompanyName(companyTitle),
          description: "",
          description_html: null,
          start_date: parsed.startDate,
          end_date: parsed.endDate,
          meta: meta,
          location: loc,
        });
      }

      entries.push({
        company: cleanCompanyName(companyTitle),
        company_id: slugify(cleanCompanyName(companyTitle)),
        company_logo_url: logoUrl,
        description: "",
        description_html: null,
        start_date: "",
        end_date: "",
        duration: totalDuration,
        location: "",
        title: cleanCompanyName(companyTitle),
        url: companyUrl,
        positions: positions,
      });
    } else {
      // Single role
      const spans = item.querySelectorAll("span[aria-hidden='true']");
      const texts = Array.from(spans).map((s) => text(s)).filter(Boolean);
      if (texts.length === 0) continue;

      let title = texts[0] || "";
      let company = texts.length >= 2 ? texts[1] : "";
      let meta = "";
      let locationText = "";

      // Find dates
      for (let i = 1; i < Math.min(texts.length, 5); i++) {
        if (isDateRange(texts[i]) || /\b(19|20)\d{2}\b/.test(texts[i])) {
          meta = texts[i];
          locationText = texts[i + 1] || "";
          if (i === 1) company = ""; // if date is 2nd item, company name is missing from text
          break;
        }
      }

      if (!meta) {
        if (isDateRange(company)) {
          meta = company;
          company = "";
          locationText = texts.length >= 3 ? texts[2] : "";
        } else {
          meta = texts.length >= 3 ? texts[2] : "";
          locationText = texts.length >= 4 ? texts[3] : "";
        }
      }

      const parsed = parseDateMeta(meta);
      const descEl = item.querySelector(
        ".inline-show-more-text span[aria-hidden='true'], .inline-show-more-text"
      );
      const description = text(descEl) || "";

      entries.push({
        company: cleanCompanyName(company) || cleanCompanyName(title),
        company_id: slugify(cleanCompanyName(company) || cleanCompanyName(title)),
        company_logo_url: logoUrl,
        description: description,
        description_html: description ? `${description} <!---->` : null,
        start_date: parsed.startDate,
        end_date: parsed.endDate,
        duration: parsed.duration,
        location: locationText,
        title: title,
        url: companyUrl,
        positions: [],
      });
    }
  }
  return entries;
}

/* ─── education scraper ──────────────────────────────────────────────── */

function scrapeEducation() {
  const sec = findSectionByIdOrH2("education");
  if (!sec) return [];
  const items = sec.querySelectorAll(
    "li.artdeco-list__item, div.pvs-list__paged-list-item, li.pvs-list__paged-list-item"
  );
  const entries = [];
  for (const item of items) {
    const spans = item.querySelectorAll("span[aria-hidden='true']");
    const texts = Array.from(spans).map((s) => text(s)).filter((t) => t.length > 0);
    if (texts.length === 0) continue;

    const logoImg = item.querySelector("img");
    const logoUrl = logoImg ? logoImg.src : null;
    const link = item.querySelector("a[href*='/school/']");
    const url = link ? link.href : "";

    const title = texts[0] || "";
    const degreeField = texts.length >= 2 ? texts[1] : "";
    const years = texts.length >= 3 ? texts[2] : "";

    let degree = "";
    let field = "";
    if (degreeField.includes(",")) {
      const parts = degreeField.split(",").map((p) => p.trim());
      degree = parts[0];
      field = parts.slice(1).join(", ");
    } else {
      degree = degreeField;
    }

    let startYear = "";
    let endYear = "";
    if (years) {
      const ym = years.match(/(\d{4})\s*[-–]\s*(\d{4})/);
      if (ym) {
        startYear = ym[1];
        endYear = ym[2];
      }
    }

    entries.push({
      degree: degree,
      field: field,
      title: title,
      description: null,
      description_html: null,
      start_year: startYear,
      end_year: endYear,
      institute_logo_url: logoUrl,
      url: url,
    });
  }
  return entries;
}

/* ─── certifications scraper ─────────────────────────────────────────── */

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

/* ─── avatar scraper ─────────────────────────────────────────────────── */

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

/* ─── connections / followers ────────────────────────────────────────── */

function scrapeConnectionsFollowers() {
  let connections = null;
  let followers = null;

  // Restrict to the top profile card to avoid grabbing follower counts from 
  // random posts in the Activity feed or companies in the Experience section
  const topCard = 
    document.querySelector("main section.pv-top-card") || 
    document.querySelector("main section.artdeco-card") || 
    document.querySelector("main");
    
  if (!topCard) return { connections, followers };

  const spans = topCard.querySelectorAll("span, li, a");
  for (const s of spans) {
    if (connections !== null && followers !== null) break;

    const t = text(s).toLowerCase();
    
    // Parse things like "500+ connections" or "1.2K connections"
    if (connections === null && t.includes("connection")) {
      const m = t.match(/([\d,.]+)\s*([km]?)\+?\s*connection/);
      if (m) {
        let num = parseFloat(m[1].replace(/,/g, ""));
        if (m[2] === "k") num *= 1000;
        if (m[2] === "m") num *= 1000000;
        connections = Math.floor(num);
      }
    }
    
    // Parse things like "529,818 followers" or "1M followers"
    if (followers === null && t.includes("follower")) {
      const m = t.match(/([\d,.]+)\s*([km]?)\+?\s*follower/);
      if (m) {
        let num = parseFloat(m[1].replace(/,/g, ""));
        if (m[2] === "k") num *= 1000;
        if (m[2] === "m") num *= 1000000;
        followers = Math.floor(num);
      }
    }
  }
  return { connections, followers };
}

/* ─── activity scraper ───────────────────────────────────────────────── */

function scrapeActivity() {
  const sec = findSectionByIdOrH2("activity") || findSectionByIdOrH2("recent-activity");
  if (!sec) return [];

  // Find the post containers. Includes the user-reported 'fie-impression-container' and carousel items.
  let items = Array.from(sec.querySelectorAll(
    ".fie-impression-container, li.profile-creator-shared-feed-update__container, div.feed-shared-update-v2, div[data-urn*='activity'], div.occludable-update, .update-components-mini-update-v2, .carousel-update-commentary"
  ));
  
  if (items.length === 0) {
     // Fallback: find the first ul inside the activity section and grab its direct li children
     const ul = sec.querySelector("ul");
     if (ul) {
       items = Array.from(ul.children).filter(c => c.tagName === "LI");
     } else {
       // Carousel fallback: sometimes it uses a list of divs inside a track
       const track = sec.querySelector(".scaffold-finite-scroll, .artdeco-carousel__content");
       if (track) {
         items = Array.from(track.children).filter(c => c.tagName === "DIV" || c.tagName === "LI");
       }
     }
  }

  const activities = [];
  for (const item of items) {
    // Find a link to the post. Often the container itself is a link or contains one.
    const linkEl = item.querySelector("a[href*='/posts/'], a[href*='/activity/'], a[href*='/feed/update/'], a[href*='urn:li:activity']");
    const link = linkEl ? linkEl.href : "";
    
    // Extract ID from URN or Link
    let id = null;
    const urnAttr = item.getAttribute("data-urn") || (linkEl ? linkEl.getAttribute("data-urn") : null);
    if (urnAttr) {
       const m = urnAttr.match(/activity:(\d+)/);
       if (m) id = m[1];
    }
    if (!id && link) {
       const m = link.match(/([0-9]{18,})/); // LinkedIn activity IDs are typically 19 digits
       if (m) id = m[1];
    }
    
    // Extract Image (prioritizing feed images over tiny avatars)
    const imgEl = item.querySelector("img[src*='media.licdn.com/dms/image'][width=''], img.update-components-image__image, .feed-shared-image__image, .ivm-view-attr__img-wrapper img");
    const img = imgEl ? imgEl.src : (item.querySelector("img")?.src || null);
    
    // Grab text content safely. Includes break-words for newer LinkedIn layouts.
    const spans = item.querySelectorAll("span[dir='ltr'], span[aria-hidden='true'], .feed-shared-update-v2__description, .break-words");
    const texts = Array.from(spans).map(s => text(s)).filter(t => t.length > 5);
    
    let interaction = "";
    let title = "";
    
    if (texts.length > 0) {
      if (/Liked by|Commented|Shared|Reposted/i.test(texts[0])) {
        interaction = texts[0];
        title = texts.slice(1).join(" ").substring(0, 300).trim();
      } else {
        title = texts.join(" ").substring(0, 300).trim();
      }
    } else {
      // Fallback: dump the entire item text
      title = text(item).replace(/\s+/g, " ").substring(0, 300).trim();
    }
    
    if (!title && !img) continue;
    
    activities.push({
      id: id || `generated-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      img: img,
      interaction: interaction,
      link: link,
      title: title
    });
    
    if (activities.length >= 10) break;
  }
  
  return activities;
}

/* ─── additional sections ────────────────────────────────────────────── */

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

/* ─── main LinkedIn profile extractor ────────────────────────────────── */

function extractLinkedInProfile() {
  const warnings = [];

  // Name
  const nameEl =
    document.querySelector("main h1.text-heading-xlarge") ||
    document.querySelector("h1.text-heading-xlarge") ||
    document.querySelector("main h1");
  const profileName = text(nameEl);
  if (!profileName) warnings.push("Could not find name (open a /in/ profile?)");

  // Headline
  const headlineEl =
    document.querySelector("main .pv-text-details__left-panel .text-body-medium") ||
    document.querySelector("main div.text-body-medium.break-words") ||
    document.querySelector("main .text-body-medium");
  let headline = text(headlineEl);
  if (!headline) {
    const topCard = document.querySelector("main section") || document.querySelector("main .pv-top-card");
    if (topCard) {
      for (const s of topCard.querySelectorAll("span")) {
        const t = text(s);
        if (t.length > 12 && t.length < 220) { headline = t; break; }
      }
    }
  }
  if (!headline) warnings.push("Could not read headline");

  // Location
  const locEl =
    document.querySelector("main span.text-body-small.inline.t-black--light") ||
    document.querySelector("main .pv-text-details__left-panel span.text-body-small") ||
    document.querySelector("main .text-body-small.inline");
  const profileLocation = text(locEl);
  if (!profileLocation) warnings.push("Could not read location");

  // About
  let profileAbout = "";
  const aboutSec = findSectionByIdOrH2("about");
  if (aboutSec) {
    const showMore =
      aboutSec.querySelector(".inline-show-more-text span[aria-hidden='true']") ||
      aboutSec.querySelector(".inline-show-more-text") ||
      aboutSec.querySelector("span.break-words");
    profileAbout = text(showMore);
    if (!profileAbout || profileAbout.length < 20) {
      profileAbout = text(aboutSec);
    }
    // Strip leading "About" heading text that LinkedIn includes in the section
    profileAbout = profileAbout
      .replace(/^(About\s*){1,2}/i, "")
      .trim()
      .slice(0, 2000);
  }

  // Company
  let company = companyFromHeadline(headline);
  if (!company) company = linkedInCompanyFromExperience();
  if (!company) {
    const orgLink = document.querySelector('main a[href*="/company/"]');
    if (orgLink) {
      const span = orgLink.querySelector("span[aria-hidden='true']") || orgLink;
      company = text(span);
    }
  }
  if (!company) warnings.push("Could not read company");

  // LinkedIn ID
  const linkedinId = extractLinkedInId();

  // Avatar
  const avatar = scrapeAvatar();

  // Connections / Followers
  const { connections, followers } = scrapeConnectionsFollowers();

  // Experience
  const experienceFull = scrapeExperience();
  const lastExperience = experienceFull.length > 0 ? experienceFull[0] : null;

  // Education
  const educationFull = scrapeEducation();
  const lastEducation = educationFull.length > 0 ? educationFull[0].title : null;

  // Certifications
  const certifications = scrapeCertifications();

  // Additional Data
  const openToWork = scrapeOpenToWork();
  const languages = scrapeLanguages();
  const projects = scrapeProjects();
  const volunteer = scrapeVolunteer();
  const recommendationsCount = scrapeRecommendationsCount();

  // Parse location into city / state / country
  let locationCity = "";
  let locationState = "";
  const countryCode = determineCountryCode(profileLocation);
  if (profileLocation) {
    const parts = profileLocation.split(",").map((p) => p.trim());
    if (parts.length >= 1) locationCity = parts[0].toLowerCase();
    if (parts.length >= 2) locationState = parts[1].toLowerCase();
  }

  // Activity
  const activity = scrapeActivity();

  // Build the output in final_profile_json_format
  const profile = {
    _id: null,
    profile_uuid: null,
    profile_linkedin_id: linkedinId,
    linkedin_num_id: null,
    profile_name: profileName,
    profile_about: profileAbout,
    profile_current_position: headline,
    profile_url: window.location.href,
    url: window.location.href,
    avatar: avatar,
    profile_location: profileLocation,
    profile_country_code: countryCode,
    location_city: locationCity,
    location_state: locationState,
    geo_point: null,
    company_id: slugify(company),
    company_uuid: null,
    company_website: null,
    employees_in_linkedin: null,
    experience_years: calculateExperienceYears(experienceFull),
    open_to_work_flag: openToWork,
    open_to_network_flag: false,
    availability_keywords: [],
    temp_keywords: [],
    staffing_company_history: [],
    profile_connections: connections,
    profile_followers: followers,
    profile_activity: activity,
    profile_experience_full: experienceFull,
    profile_last_experience: lastExperience,
    profile_education_full: educationFull,
    profile_last_education: lastEducation,
    profile_certifications: certifications,
    profile_courses: null,
    profile_languages: languages,
    profile_organizations: null,
    profile_posts: null,
    profile_projects: projects,
    profile_publications: null,
    profile_recommendations: null,
    profile_recommendations_count: recommendationsCount,
    profile_volunteer_experience: volunteer,
    created_at: null,
    updated_at: null,
    data_source: "chrome_extension",
    data_source_ref: null,
  };

  return { profile, warnings };
}

/* ─── fixture extractor (localhost demo) ─────────────────────────────── */

function extractFixtureProfile() {
  const warnings = [];
  const nameEl = document.querySelector("[data-proto-name]");
  const headlineEl = document.querySelector("[data-proto-headline]");
  const companyEl = document.querySelector("[data-proto-company]");
  const locationEl = document.querySelector("[data-proto-location]");
  const aboutEl = document.querySelector("[data-proto-about]");

  const profileName = text(nameEl);
  const headline = text(headlineEl);
  const company = text(companyEl);
  const location = text(locationEl);
  const about = text(aboutEl);

  // Read linkedin ID from data attribute, fallback to "fixture-demo"
  const linkedinIdEl = document.querySelector("[data-proto-linkedin-id]");
  const linkedinId = linkedinIdEl
    ? linkedinIdEl.getAttribute("data-proto-linkedin-id")
    : "fixture-demo";

  if (!profileName) warnings.push("Fixture missing [data-proto-name]");

  // Build a minimal experience entry from the company name
  const experienceEntry = company
    ? {
        company: company,
        company_id: slugify(company),
        company_logo_url: null,
        description: "",
        description_html: null,
        start_date: "",
        end_date: "Present",
        duration: "",
        location: location,
        title: headline,
        url: "",
        positions: [],
      }
    : null;

  const profile = {
    _id: null,
    profile_uuid: null,
    profile_linkedin_id: linkedinId,
    linkedin_num_id: null,
    profile_name: profileName,
    profile_about: about,
    profile_current_position: headline,
    profile_url: window.location.href,
    url: window.location.href,
    avatar: null,
    profile_location: location,
    profile_country_code: null,
    location_city: "",
    location_state: "",
    geo_point: null,
    company_id: slugify(company),
    company_uuid: null,
    company_website: null,
    employees_in_linkedin: null,
    experience_years: null,
    open_to_work_flag: false,
    open_to_network_flag: false,
    availability_keywords: [],
    temp_keywords: [],
    staffing_company_history: [],
    profile_connections: null,
    profile_followers: null,
    profile_activity: [],
    profile_experience_full: experienceEntry ? [experienceEntry] : [],
    profile_last_experience: experienceEntry,
    profile_education_full: [],
    profile_last_education: null,
    profile_certifications: [],
    profile_courses: null,
    profile_languages: null,
    profile_organizations: null,
    profile_posts: null,
    profile_projects: null,
    profile_publications: null,
    profile_recommendations: null,
    profile_recommendations_count: null,
    profile_volunteer_experience: null,
    created_at: null,
    updated_at: null,
    data_source: "chrome_extension_fixture",
    data_source_ref: null,
  };

  return { profile, warnings };
}

/* ─── main entry point ───────────────────────────────────────────────── */

function extractProfile() {
  const hostname = window.location.hostname;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const { profile, warnings } = extractFixtureProfile();
    return {
      profile,
      meta: {
        capturedAt: new Date().toISOString(),
        source: hostname,
        profileUrl: window.location.href,
        warnings,
      },
    };
  }

  if (hostname.endsWith("linkedin.com")) {
    const { profile, warnings } = extractLinkedInProfile();
    return {
      profile,
      meta: {
        capturedAt: new Date().toISOString(),
        source: hostname,
        profileUrl: window.location.href,
        warnings,
      },
    };
  }

  return {
    profile: null,
    meta: {
      capturedAt: new Date().toISOString(),
      source: hostname,
      profileUrl: window.location.href,
      warnings: ["Unsupported host for prototype: " + hostname],
    },
  };
}

/* ─── message listener ───────────────────────────────────────────────── */

if (!globalThis.__PROFILE_CAPTURE_PROTO_LISTENER__) {
  globalThis.__PROFILE_CAPTURE_PROTO_LISTENER__ = true;
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "EXTRACT_PROFILE") {
      try {
        const data = extractProfile();
        sendResponse({ ok: true, data });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
      return true;
    }
    return false;
  });
}
