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
