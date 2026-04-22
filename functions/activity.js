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
