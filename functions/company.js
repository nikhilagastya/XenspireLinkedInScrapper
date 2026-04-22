/**
 * Extract company name from LinkedIn headline.
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
