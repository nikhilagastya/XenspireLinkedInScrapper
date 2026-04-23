/**
 * Mock server data — simulates what the backend already has for known profiles.
 * Some fields are intentionally different from current LinkedIn data to demo
 * the compare & highlight feature.
 */
const MOCK_SERVER_RECORDS = {
  "amanda-dennis-842265103": {
    _id: { $oid: "69ba1df3152a0edc7d0613f9" },
    profile_uuid: "1e35060b-36cc-42d9-9d2e-188d84d3b4d1",
    profile_linkedin_id: "amanda-dennis-842265103",
    linkedin_num_id: "439571570",
    profile_name: "Amanda M. Dennis",
    profile_about:
      "Over five years of experience in plastics Manufacturing (one year as a co-op in college…",
    profile_current_position: "Inspection Engineer at SABIC Inc.",
    profile_url: "https://in.linkedin.com/in/Amanda-dennis-842265103",
    url: "https://in.linkedin.com/in/Amanda-dennis-842265103",
    avatar:
      "https://media.licdn.com/dms/image/v2/C4E03AQHZIyrwteAT_g/profile-displayphoto-shrink_200_200/0/1591210964647",
    profile_location: "Montgomery, Alabama, United States",
    profile_country_code: "US",
    location_city: "montgomery",
    location_state: "alabama",
    company_id: "sabic",
    company_uuid: "62493f7e-9b92-40da-b381-705386852209",
    company_website: null,
    personal_email: "amanda.d.personal@gmail.com",
    personal_phone: "+1 555-019-2041",
    work_email: "adennis@sabic.com",
    work_phone: "+1 555-901-3844",
    employees_in_linkedin: 38358,
    experience_years: 9,
    open_to_work_flag: false,
    open_to_network_flag: false,
    profile_connections: 483,
    profile_followers: 489,
    profile_experience_full: [{ company: "SABIC Inc.", company_id: "sabic", title: "Inspection Engineer" }],
    profile_last_experience: { company: "SABIC Inc.", company_id: "sabic", title: "Inspection Engineer" },
    created_at: { $date: "2026-03-18T03:37:22.673Z" },
    updated_at: { $date: "2026-03-18T09:09:50.148Z" },
    data_source: "brightdata",
  },
  "maher-sarah-73b228102": {
    _id: { $oid: "69b9a710152a0edc7d054d5d" },
    profile_uuid: "429c13e7-849c-4c82-9019-16a85f83e239",
    profile_linkedin_id: "maher-sarah-73b228102",
    linkedin_num_id: "436507679",
    profile_name: "Sarah Maher",
    profile_about:
      "Digital construction: Driving regional expansion of Digital Services across the US and…",
    profile_current_position: "Regional Sales Manager at Doka Group",
    profile_url: "https://www.linkedin.com/in/maher-sarah-73b228102",
    url: "https://www.linkedin.com/in/maher-sarah-73b228102",
    avatar:
      "https://media.licdn.com/dms/image/v2/D4D03AQGjqDubadxdiQ/profile-displayphoto-shrink_200_200/0/1689085810789",
    profile_location: "Spring, Texas, United States",
    profile_country_code: null,
    location_city: "spring",
    location_state: "texas",
    company_id: "doka-usa",
    company_uuid: "330f14d9-138f-4950-bde8-ba70899f9231",
    company_website: null,
    personal_email: "sarah.maher99@yahoo.com",
    personal_phone: "+1 555-882-1023",
    work_email: "sarah.maher@doka.com",
    work_phone: "+1 555-773-9090",
    employees_in_linkedin: 263,
    experience_years: 13,
    open_to_work_flag: false,
    open_to_network_flag: false,
    profile_connections: null,
    profile_followers: null,
    profile_experience_full: [{ company: "Doka Group", company_id: "doka-usa", title: "Regional Sales Manager" }],
    profile_last_experience: { company: "Doka Group", company_id: "doka-usa", title: "Regional Sales Manager" },
    created_at: { $date: "2026-03-17T19:10:08.355Z" },
    updated_at: null,
    data_source: null,
  },
};

/**
 * Look up a known server record by LinkedIn ID slug.
 */
function getServerRecord(linkedinId, scrapedProfile) {
  // If we have a hardcoded mock record, return it (Existing Contact)
  if (MOCK_SERVER_RECORDS[linkedinId]) {
    return structuredClone(MOCK_SERVER_RECORDS[linkedinId]);
  }

  // Set this to `true` if you want to test the "Compare" UI on every profile you visit.
  // Set this to `false` to test the "New Contact" (data not on server) flow.
  const SIMULATE_ALL_EXIST = false;

  if (!SIMULATE_ALL_EXIST) {
    return null; // Simulate profile not existing in the backend database
  }

  // Generate mock "server" data with intentional diffs for testing


  return {
    _id: { $oid: "mock-" + Date.now().toString(16) },
    profile_uuid: crypto.randomUUID ? crypto.randomUUID() : "mock-uuid-" + Date.now(),
    profile_linkedin_id: linkedinId || "unknown",
    linkedin_num_id: null,
    // Intentionally alter name/title/company to show diffs
    profile_name: scrapedProfile.profile_name
      ? scrapedProfile.profile_name + " (Server)"
      : "",
    profile_current_position: scrapedProfile.profile_current_position
      ? scrapedProfile.profile_current_position.replace(/\bat\b/i, "@ ").trim()
      : "",
    profile_url: scrapedProfile.profile_url || "",
    url: scrapedProfile.url || "",
    avatar: scrapedProfile.avatar || "",
    profile_location: scrapedProfile.profile_location || "",
    profile_country_code: null,
    company_id: scrapedProfile.company_id
      ? scrapedProfile.company_id + "-global"
      : null,
    company_uuid: null,
    company_website: null,
    personal_email: "mock.personal@example.com",
    personal_phone: "+1 000-000-0000",
    work_email: "mock.work@company.com",
    work_phone: "+1 111-111-1111",
    open_to_work_flag: false,
    open_to_network_flag: false,
    profile_connections: null,
    profile_followers: null,
    profile_experience_full: scrapedProfile.profile_experience_full
      ? scrapedProfile.profile_experience_full.map((e) => ({
          ...e,
          company: e.company ? e.company + " Global" : e.company,
        }))
      : null,
    profile_last_experience: scrapedProfile.profile_last_experience
      ? {
          ...scrapedProfile.profile_last_experience,
          company: scrapedProfile.profile_last_experience.company
            ? scrapedProfile.profile_last_experience.company + " Global"
            : "",
        }
      : null,
    created_at: { $date: new Date().toISOString() },
    updated_at: null,
    data_source: "mock_server",
  };
}
