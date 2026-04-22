/**
 * Content script: LinkedIn profile DOM scraper.
 * Outputs data in the final_profile_json_format schema.
 *
 * LinkedIn markup changes often; use fixture/profile-mock.html on localhost
 * for a stable demo.
 */

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
