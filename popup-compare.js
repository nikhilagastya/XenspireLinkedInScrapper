/**
 * popup-compare.js
 * Pure comparison logic — no DOM manipulation here.
 * Compares scraped LinkedIn profile data against server records.
 */

/**
 * Fields we compare between LinkedIn and server data.
 * Each entry defines the key to read, a human-readable label,
 * and an optional extractor for nested values.
 */
const COMPARE_FIELDS = [
  {
    key: "profile_name",
    label: "Name",
    extract: (profile) => profile?.profile_name || "",
  },
  {
    key: "profile_current_position",
    label: "Current Title",
    extract: (profile) => profile?.profile_current_position || "",
  },
  {
    key: "company_id",
    label: "Current Company",
    extract: (profile) => {
      // Prefer the first experience company name, fallback to company_id
      if (
        profile?.profile_last_experience?.company ||
        profile?.profile_experience_full?.[0]?.company
      ) {
        return (
          profile.profile_last_experience?.company ||
          profile.profile_experience_full[0].company
        );
      }
      return profile?.company_id || "";
    },
  },
];

/**
 * Normalize a string for comparison: lowercase, collapse whitespace, trim.
 */
function normalizeForCompare(val) {
  if (val == null) return "";
  return String(val).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Compare a scraped profile against server data.
 *
 * @param {Object} scrapedProfile  - Profile from content.js extraction
 * @param {Object} serverRecord    - Profile from mock server / backend
 * @returns {Array<CompareResult>} - Array of { key, label, linkedinValue, serverValue, isMatch }
 */
function compareProfiles(scrapedProfile, serverRecord) {
  return COMPARE_FIELDS.map((field) => {
    const linkedinValue = field.extract(scrapedProfile);
    const serverValue = field.extract(serverRecord);
    const isMatch =
      normalizeForCompare(linkedinValue) === normalizeForCompare(serverValue);

    return {
      key: field.key,
      label: field.label,
      linkedinValue: linkedinValue || "(empty)",
      serverValue: serverValue || "(empty)",
      isMatch,
    };
  });
}

/**
 * Check if any fields differ between scraped and server data.
 */
function hasDifferences(compareResults) {
  return compareResults.some((r) => !r.isMatch);
}

/**
 * Build a partial update payload from selected diff fields.
 * Only includes fields where the user checked "update with LinkedIn value".
 * If editedValues are provided, those take priority over scraped profile values.
 *
 * @param {Array<string>} selectedKeys - Keys the user chose to update
 * @param {Object} scrapedProfile      - The scraped profile data
 * @param {Object} [editedValues={}]   - Map of fieldKey → user-edited value (from editable inputs)
 * @returns {Object}                   - Partial update payload
 */
function buildUpdatePayload(selectedKeys, scrapedProfile, editedValues = {}) {
  const payload = {};
  for (const field of COMPARE_FIELDS) {
    if (selectedKeys.includes(field.key)) {
      // Use edited value if available, otherwise fall back to scraped value
      payload[field.key] =
        editedValues.hasOwnProperty(field.key)
          ? editedValues[field.key]
          : field.extract(scrapedProfile);
    }
  }
  return payload;
}
