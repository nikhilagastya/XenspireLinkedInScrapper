/**
 * Helper functions for DOM manipulation and data extraction.
 */

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
