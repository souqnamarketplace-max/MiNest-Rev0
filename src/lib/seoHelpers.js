/**
 * SEO Helpers for MiNest
 * - City slug ↔ display name conversion
 * - Unique city SEO content + FAQ generation
 * - Dynamic meta tag injection (title, desc, canonical, OG, Twitter, JSON-LD)
 * - Structured data helpers (RealEstateListing, BreadcrumbList, FAQPage)
 */

// ─── Slug helpers ────────────────────────────────────────────────────────────

export function cityToSlug(city) {
  return city.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function slugToCity(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function cityPageUrl(city) {
  return `/rooms-for-rent/${cityToSlug(city)}`;
}

// ─── Nearby cities ────────────────────────────────────────────────────────────

const NEARBY_CITIES_MAP = {
  toronto: ["Mississauga", "Brampton", "Scarborough", "North York", "Etobicoke"],
  vancouver: ["Burnaby", "Surrey", "Richmond", "Coquitlam", "New Westminster"],
  calgary: ["Airdrie", "Cochrane", "Chestermere", "Okotoks", "Red Deer"],
  edmonton: ["St. Albert", "Sherwood Park", "Spruce Grove", "Leduc", "Fort Saskatchewan"],
  montreal: ["Laval", "Longueuil", "Brossard", "Gatineau", "Saint-Laurent"],
  ottawa: ["Gatineau", "Kanata", "Nepean", "Orleans", "Barrhaven"],
  winnipeg: ["Steinbach", "Brandon", "Selkirk", "Portage la Prairie", "Winkler"],
  hamilton: ["Burlington", "Oakville", "Brantford", "Cambridge", "Kitchener"],
  kitchener: ["Waterloo", "Cambridge", "Guelph", "Hamilton", "London"],
  london: ["Kitchener", "Windsor", "Guelph", "Hamilton", "Sarnia"],
  halifax: ["Dartmouth", "Bedford", "Sackville", "Truro", "Bridgewater"],
  saskatoon: ["Regina", "Moose Jaw", "Prince Albert", "Lloydminster"],
  regina: ["Saskatoon", "Moose Jaw", "Swift Current", "Weyburn"],
  victoria: ["Saanich", "Esquimalt", "Oak Bay", "Langford", "Colwood"],
  windsor: ["London", "Chatham-Kent", "Sarnia", "Leamington"],
  mississauga: ["Toronto", "Brampton", "Oakville", "Burlington"],
  brampton: ["Mississauga", "Toronto", "Caledon", "Vaughan"],
  surrey: ["Vancouver", "Burnaby", "Richmond", "Langley"],
  burnaby: ["Vancouver", "New Westminster", "Coquitlam", "Surrey"],
};

export function getNearbyCities(citySlug) {
  return NEARBY_CITIES_MAP[citySlug.toLowerCase()] || [];
}

// ─── City metadata ─────────────────────────────────────────────────────────────

const CITY_PROVINCE = {
  // Canada
  toronto: "Ontario", mississauga: "Ontario", brampton: "Ontario", ottawa: "Ontario",
  hamilton: "Ontario", london: "Ontario", kitchener: "Ontario", windsor: "Ontario",
  vancouver: "British Columbia", burnaby: "British Columbia", surrey: "British Columbia",
  richmond: "British Columbia", victoria: "British Columbia",
  calgary: "Alberta", edmonton: "Alberta",
  montreal: "Quebec", laval: "Quebec", gatineau: "Quebec",
  winnipeg: "Manitoba",
  saskatoon: "Saskatchewan", regina: "Saskatchewan",
  halifax: "Nova Scotia",
  // United States
  "new york": "New York", "new-york": "New York", nyc: "New York", manhattan: "New York", brooklyn: "New York",
  "los angeles": "California", "los-angeles": "California", "san francisco": "California", "san-francisco": "California",
  seattle: "Washington",
  austin: "Texas", dallas: "Texas", houston: "Texas", "san antonio": "Texas", "san-antonio": "Texas",
  chicago: "Illinois",
  washington: "District of Columbia", "washington dc": "District of Columbia",
  miami: "Florida", orlando: "Florida", tampa: "Florida", jacksonville: "Florida",
  portland: "Oregon",
  denver: "Colorado",
  minneapolis: "Minnesota",
  boston: "Massachusetts",
  phoenix: "Arizona",
  "las vegas": "Nevada", "las-vegas": "Nevada",
  atlanta: "Georgia",
  philadelphia: "Pennsylvania",
  detroit: "Michigan",
  nashville: "Tennessee",
  charlotte: "North Carolina",
  "san diego": "California", "san-diego": "California",
};

// Map city to country
const CITY_COUNTRY = {
  "new york": "USA", "new-york": "USA", nyc: "USA", manhattan: "USA", brooklyn: "USA",
  "los angeles": "USA", "los-angeles": "USA", "san francisco": "USA", "san-francisco": "USA",
  seattle: "USA", austin: "USA", dallas: "USA", houston: "USA", "san antonio": "USA", "san-antonio": "USA",
  chicago: "USA", washington: "USA", "washington dc": "USA",
  miami: "USA", orlando: "USA", tampa: "USA", jacksonville: "USA",
  portland: "USA", denver: "USA", minneapolis: "USA", boston: "USA",
  phoenix: "USA", "las vegas": "USA", "las-vegas": "USA",
  atlanta: "USA", philadelphia: "USA", detroit: "USA",
  nashville: "USA", charlotte: "USA", "san diego": "USA", "san-diego": "USA",
};

export function getCityCountry(citySlug) {
  return CITY_COUNTRY[citySlug.toLowerCase()] || "Canada";
}

export function getCityProvince(citySlug) {
  return CITY_PROVINCE[citySlug.toLowerCase()] || "";
};

// Rich per-city data for unique content and FAQ answers
const CITY_RICH_DATA = {
  toronto: {
    avgRent: "$950–$1,700/month",
    neighborhoods: "the Annex, Kensington Market, Scarborough, North York, and Etobicoke",
    transit: "the TTC subway, streetcar, and bus network",
    population: "the largest city in Canada",
    tip: "Rooms near subway lines fill fastest — set up a saved search alert on MiNest to be notified the moment new listings go live.",
  },
  vancouver: {
    avgRent: "$1,100–$2,000/month",
    neighborhoods: "Commercial Drive, Kitsilano, Mount Pleasant, East Vancouver, and Burnaby",
    transit: "the SkyTrain rapid transit and extensive bus network",
    population: "one of Canada's most sought-after cities",
    tip: "Vancouver's rental market is highly competitive. Having your MiNest profile complete with a verified ID significantly improves your chances with landlords.",
  },
  calgary: {
    avgRent: "$750–$1,400/month",
    neighborhoods: "Beltline, Kensington, Inglewood, Marda Loop, and the Northeast",
    transit: "the CTrain light rail and Calgary Transit buses",
    population: "Alberta's largest city and a growing tech and energy hub",
    tip: "Calgary has no provincial rent control, so prices can vary widely. Use MiNest's price history feature to compare listings and spot good value.",
  },
  edmonton: {
    avgRent: "$650–$1,200/month",
    neighborhoods: "Whyte Avenue, Oliver, Glenora, Mill Woods, and West Edmonton",
    transit: "the Metro LRT and Edmonton Transit buses",
    population: "Alberta's capital and a fast-growing tech and oil-sands hub",
    tip: "Edmonton is one of the most affordable major cities in Canada. Listings near the LRT and the University of Alberta tend to fill quickly.",
  },
  montreal: {
    avgRent: "$600–$1,100/month",
    neighborhoods: "the Plateau, Mile End, Verdun, NDG, and Rosemont",
    transit: "the STM Métro and extensive bus network",
    population: "Canada's second-largest city and a vibrant bilingual metropolis",
    tip: "Most Montreal leases begin on July 1. Start your MiNest search at least 2–3 months in advance to secure the best rooms.",
  },
  ottawa: {
    avgRent: "$800–$1,400/month",
    neighborhoods: "Centretown, the Glebe, Sandy Hill, Vanier, and Westboro",
    transit: "the O-Train Confederation Line and OC Transpo buses",
    population: "Canada's capital city with a large student and government workforce",
    tip: "Sandy Hill and Vanier offer affordable rooms close to the University of Ottawa. Use MiNest filters to find furnished rooms with utilities included.",
  },
  winnipeg: {
    avgRent: "$550–$1,000/month",
    neighborhoods: "Wolseley, St. Boniface, Exchange District, Fort Rouge, and Crescentwood",
    transit: "Winnipeg Transit bus network",
    population: "Manitoba's capital and the gateway to Western Canada",
    tip: "Winnipeg is one of Canada's most affordable rental markets. MiNest listings here often include utilities — use the 'bills included' filter to find the best value.",
  },
  hamilton: {
    avgRent: "$700–$1,200/month",
    neighborhoods: "Westdale, Locke Street, Crown Point, Stoney Creek, and Dundas",
    transit: "Hamilton Street Railway (HSR) buses and GO Transit to Toronto",
    population: "a rapidly growing city with easy access to Toronto",
    tip: "Hamilton is increasingly popular with Toronto workers seeking affordable rents. Rooms near the GO station and on bus routes fill quickly.",
  },
  kitchener: {
    avgRent: "$750–$1,250/month",
    neighborhoods: "Downtown Kitchener, Uptown Waterloo, Victoria Hills, and Doon",
    transit: "the ION light rail transit and Grand River Transit buses",
    population: "the heart of Canada's tech corridor — the Waterloo Region",
    tip: "The Waterloo Region is home to Waterloo University, Wilfrid Laurier, and a major tech scene. Student and professional rooms are both in high demand.",
  },
  london: {
    avgRent: "$700–$1,150/month",
    neighborhoods: "Old East Village, Wortley Village, Old North, Masonville, and White Oaks",
    transit: "London Transit bus network",
    population: "a mid-size university city in Southwestern Ontario",
    tip: "Rooms near Western University and Fanshawe College are always in demand. Start your MiNest search early in the spring for September move-ins.",
  },
  halifax: {
    avgRent: "$850–$1,500/month",
    neighborhoods: "South End, North End, Dartmouth, Clayton Park, and Bedford",
    transit: "Halifax Metro Transit bus and ferry network",
    population: "Atlantic Canada's largest city and a major university hub",
    tip: "Halifax has one of the tightest rental markets in Atlantic Canada. MiNest's roommate matching helps you find verified housemates quickly.",
  },
  saskatoon: {
    avgRent: "$550–$1,000/month",
    neighborhoods: "Broadway, Riversdale, University Heights, City Park, and Sutherland",
    transit: "Saskatoon Transit bus network",
    population: "Saskatchewan's largest city and a growing agricultural and tech hub",
    tip: "Saskatoon has very affordable rooms. Look for listings near the University of Saskatchewan for furnished rooms with flexible lease terms.",
  },
  victoria: {
    avgRent: "$950–$1,700/month",
    neighborhoods: "James Bay, Fernwood, Fairfield, Cook Street Village, and Langford",
    transit: "BC Transit bus network across Greater Victoria",
    population: "British Columbia's capital city and a popular destination for students and retirees",
    tip: "Victoria has limited rental supply and high demand. Complete your MiNest profile with verified ID to stand out to landlords.",
  },
};

const DEFAULT_CITY_DATA = {
  avgRent: "$700–$1,500/month",
  neighborhoods: "a variety of neighborhoods across the city",
  transit: "local transit options",
  population: "a vibrant and growing city",
  tip: "Set up a saved search on MiNest to get instant alerts when new rooms are listed in your area.",
};

// US city data
const US_CITY_RICH_DATA = {
  "new york": {
    avgRent: "$1,200–$2,500/month",
    neighborhoods: "Brooklyn, Manhattan, Queens, the East Village, and Williamsburg",
    transit: "the MTA subway, bus, and commuter rail network",
    population: "the largest city in the United States",
    tip: "NYC rooms go fast — set up a saved search alert on MiNest to be the first to know when new listings go live in your preferred borough.",
  },
  "los angeles": {
    avgRent: "$1,000–$2,000/month",
    neighborhoods: "Santa Monica, Silver Lake, the Arts District, Koreatown, and West Hollywood",
    transit: "the Metro rail and bus system, plus major freeway access",
    population: "one of America's most dynamic and diverse cities",
    tip: "LA is spread out — filter by neighborhood on MiNest to find rooms near your workplace or school and save on commute time.",
  },
  "san francisco": {
    avgRent: "$1,300–$2,500/month",
    neighborhoods: "the Mission, SoMa, Hayes Valley, Nob Hill, and the Sunset District",
    transit: "BART rapid transit, Muni buses and light rail",
    population: "a world-renowned tech hub on the West Coast",
    tip: "San Francisco has one of the tightest rental markets in the US. Complete your MiNest profile with verified ID to stand out to hosts.",
  },
  seattle: {
    avgRent: "$900–$1,600/month",
    neighborhoods: "Capitol Hill, Ballard, Fremont, South Lake Union, and the University District",
    transit: "Sound Transit Link light rail and King County Metro buses",
    population: "the Pacific Northwest's largest city and a major tech hub",
    tip: "Rooms near Link Light Rail stations fill quickly — use MiNest's map view to find listings along transit corridors.",
  },
  austin: {
    avgRent: "$750–$1,400/month",
    neighborhoods: "East Austin, Downtown, South Congress, Hyde Park, and the Domain",
    transit: "Capital Metro bus and MetroRail service",
    population: "one of America's fastest-growing cities and a major tech hub",
    tip: "Austin's rental market is booming. Listings on MiNest with utilities included are popular — use the 'bills included' filter to find them.",
  },
  chicago: {
    avgRent: "$800–$1,500/month",
    neighborhoods: "Wicker Park, Lincoln Park, Lakeview, Logan Square, and Hyde Park",
    transit: "the CTA 'L' train and extensive bus network",
    population: "the third-largest city in the United States",
    tip: "Chicago has great value compared to coastal cities. Look for rooms near the Blue or Red Line on MiNest for easy commuting.",
  },
  washington: {
    avgRent: "$1,100–$1,800/month",
    neighborhoods: "Dupont Circle, Georgetown, Capitol Hill, Adams Morgan, and Columbia Heights",
    transit: "the WMATA Metrorail and Metrobus system",
    population: "the nation's capital with a large professional and government workforce",
    tip: "DC rooms near Metro stations command a premium. Use MiNest's price filter to compare options across neighborhoods.",
  },
  miami: {
    avgRent: "$900–$1,600/month",
    neighborhoods: "South Beach, Wynwood, Brickell, Coral Gables, and Little Havana",
    transit: "Metrorail, Metromover, and Metrobus throughout Miami-Dade",
    population: "a vibrant, international city known for its culture and beaches",
    tip: "Miami's rental market is seasonal — prices peak in winter. Search on MiNest year-round to find the best deals.",
  },
  portland: {
    avgRent: "$800–$1,400/month",
    neighborhoods: "the Pearl District, Hawthorne, Alberta Arts, Division, and Sellwood",
    transit: "TriMet MAX light rail and bus network",
    population: "a creative and eco-conscious city in the Pacific Northwest",
    tip: "Portland is very bike-friendly — filter by neighborhood on MiNest and consider biking distance instead of transit for even more options.",
  },
  denver: {
    avgRent: "$800–$1,400/month",
    neighborhoods: "the Highlands, RiNo, Capitol Hill, Cherry Creek, and LoDo",
    transit: "RTD light rail and bus network",
    population: "a fast-growing city at the foot of the Rocky Mountains",
    tip: "Denver's housing market is competitive. Having a complete MiNest profile with photos and a bio helps you stand out to hosts.",
  },
  minneapolis: {
    avgRent: "$650–$1,200/month",
    neighborhoods: "Uptown, Northeast, North Loop, Whittier, and Loring Park",
    transit: "Metro Transit light rail and bus system",
    population: "a vibrant Midwestern city with a thriving arts and food scene",
    tip: "Minneapolis offers great value compared to coastal cities. Use MiNest's 'heat and water included' filter — it's common here.",
  },
  boston: {
    avgRent: "$1,200–$2,200/month",
    neighborhoods: "Back Bay, Allston, Cambridge, Somerville, and Jamaica Plain",
    transit: "the MBTA subway (the T), bus, and commuter rail",
    population: "a historic city with world-class universities and a thriving job market",
    tip: "Boston's rental cycle revolves around September 1 move-ins. Start searching on MiNest at least 2-3 months in advance for the best selection.",
  },
};

function getCityData(citySlug) {
  return CITY_RICH_DATA[citySlug.toLowerCase()] || US_CITY_RICH_DATA[citySlug.toLowerCase()] || DEFAULT_CITY_DATA;
}

// ─── City content generation ─────────────────────────────────────────────────

export function generateCityContent(city) {
  const slug = cityToSlug(city);
  const province = getCityProvince(slug);
  const data = getCityData(slug);

  const locationLabel = province ? `${city}, ${province}` : city;

  const intro = `Looking for rooms for rent in ${locationLabel}? MiNest is the trusted shared housing platform for ${locationLabel} — ${data.population}. Browse verified private rooms, shared apartments, and roommates in ${data.neighborhoods}. Listings are updated daily — and our compatibility matching helps you find housemates who fit your lifestyle and budget.`;

  const market = `The rental market in ${city} ranges from ${data.avgRent} for a private room, depending on location, furnishing, and included utilities. MiNest features listings across ${city} with full details on rent, bills, pet policy, and minimum stay — so you can compare options honestly before reaching out. ${data.tip}`;

  const lifestyle = `Getting around ${city} is straightforward thanks to ${data.transit}. Whether you're looking for a quiet room in a family home, a vibrant shared house with roommates, or a furnished room close to work or school, MiNest helps you filter by what matters most. Use our roommate matching features to find compatible housemates in ${city} based on lifestyle, schedule, and cleanliness preferences.`;

  return { intro, market, lifestyle };
}

// ─── City FAQ generation ──────────────────────────────────────────────────────

export function generateCityFAQs(city) {
  const slug = cityToSlug(city);
  const province = getCityProvince(slug);
  const data = getCityData(slug);

  return [
    {
      question: `What is the average rent for a room in ${city}?`,
      answer: `Private rooms in ${city}${province ? `, ${province}` : ''} typically range from ${data.avgRent}, depending on the neighbourhood, furnishing, and whether utilities are included. MiNest listings show the full breakdown — rent, deposit, and what's covered — so there are no surprises.`,
    },
    {
      question: `What types of rooms are available in ${city} on MiNest?`,
      answer: `MiNest features private rooms, shared rooms, and entire furnished units in ${city}. You can filter by room type, price, furnished status, pet policy, and more. Popular neighbourhoods include ${data.neighborhoods}.`,
    },
    {
      question: `How do I find a compatible roommate in ${city}?`,
      answer: `Create a free seeker profile on MiNest, set your budget and preferred move-in date, and browse verified hosts in ${city}. Our compatibility matching considers lifestyle, sleep schedule, cleanliness, and more so you can connect with roommates who are actually a good fit.`,
    },
    {
      question: `Is MiNest free to use in ${city}?`,
      answer: `Yes — browsing and messaging hosts on MiNest is completely free. There are no hidden fees for renters searching for rooms in ${city}. Landlords can post listings free, with optional paid boosts for extra visibility.`,
    },
    {
      question: `How quickly do rooms rent in ${city}?`,
      answer: `In ${city}, well-priced rooms can rent within days. To be first in line, create a saved search on MiNest and enable instant alerts — you'll be notified the moment a new listing matching your criteria is posted in ${city}.`,
    },
  ];
}

// ─── FAQ schema ──────────────────────────────────────────────────────────────

export function buildFAQSchema(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// ─── Meta tag injection ───────────────────────────────────────────────────────

/**
 * Injects/updates all SEO meta tags: title, description, canonical,
 * Open Graph (title, description, url, image, type), Twitter Card.
 * Pass ogImage as empty string to remove/skip og:image update.
 */
export function setPageMeta({ title, description, canonical, ogImage, ogType = "website" }) {
  if (title) document.title = title;

  const setMeta = (selector, attrKey, attrVal, contentKey, content) => {
    let el = document.querySelector(`meta[${attrKey}="${attrVal}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrKey, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute(contentKey || "content", content);
  };

  const setLink = (rel, href) => {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  };

  if (description) {
    setMeta(null, "name", "description", "content", description);
    setMeta(null, "property", "og:description", "content", description);
    setMeta(null, "name", "twitter:description", "content", description);
  }
  if (title) {
    setMeta(null, "property", "og:title", "content", title);
    setMeta(null, "name", "twitter:title", "content", title);
  }
  if (ogType) {
    setMeta(null, "property", "og:type", "content", ogType);
  }
  if (canonical) {
    const absCanonical = canonical.startsWith("http") ? canonical : `https://minest.ca${canonical}`;
    setLink("canonical", absCanonical);
    setMeta(null, "property", "og:url", "content", absCanonical);
  }
  // Always set twitter:card if we have an image, else keep summary
  if (ogImage) {
    setMeta(null, "property", "og:image", "content", ogImage);
    setMeta(null, "name", "twitter:image", "content", ogImage);
    setMeta(null, "name", "twitter:card", "content", "summary_large_image");
  } else {
    setMeta(null, "name", "twitter:card", "content", "summary");
  }
}

// ─── Structured data helpers ──────────────────────────────────────────────────

export function buildListingSchema(listing, hostProfile) {
  const price = listing.rent_amount || listing.monthly_rent || 0;
  const images = [];
  if (listing.cover_photo_url) images.push(listing.cover_photo_url);
  if (listing.photos?.length) {
    listing.photos.forEach((p) => { if (p && !images.includes(p)) images.push(p); });
  }

  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listing.title,
    description: listing.description || `Room for rent in ${listing.city || "Canada"}`,
    url: `https://minest.ca/listing/${listing.slug || listing.id}`,
    ...(images.length > 0 ? { image: images.length === 1 ? images[0] : images } : {}),
    offers: {
      "@type": "Offer",
      price: (price / 100).toFixed(2),
      priceCurrency: listing.currency_code || "CAD",
      availability: "https://schema.org/InStock",
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: listing.city || "",
      addressRegion: listing.province_or_state || "",
      addressCountry: listing.country || "CA",
      postalCode: listing.postal_or_zip || "",
    },
    ...(listing.available_from ? { datePosted: listing.available_from } : {}),
    ...(hostProfile?.display_name || hostProfile?.full_name
      ? {
          author: {
            "@type": "Person",
            name:
              hostProfile.display_name ||
              hostProfile.full_name,
          },
        }
      : {}),
  };
}

export function buildBreadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.path.startsWith("http") ? item.path : `https://minest.ca${item.path}`,
    })),
  };
}