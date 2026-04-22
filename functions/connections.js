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
