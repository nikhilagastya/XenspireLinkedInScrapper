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
