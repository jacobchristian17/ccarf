// Fixture research corpus for Lesson 4 (and Lesson 5). Every source is FICTIONAL: the publishers,
// URLs (.test is a reserved TLD) and figures are invented for the lab. Don't quote them as facts.
export type Subtopic = "visual-arts" | "music" | "writing" | "film-tv" | "games";

export type WebSource = {
  kind: "web"; url: string; title: string; publisher: string; published: string;
  subtopic: Subtopic; tags: string[]; snippet: string;
};
export type DocSource = {
  kind: "doc"; doc_id: string; title: string; publisher: string; published: string;
  subtopic: Subtopic; tags: string[]; pages: Record<number, string>;
};

export const WEB: WebSource[] = [
  { kind: "web", url: "https://canvas-review.test/ai-illustration-2026", title: "Illustrators and image models, two years on", publisher: "Canvas Review", published: "2026-03-14",
    subtopic: "visual-arts", tags: ["art", "illustration", "image", "visual", "artists", "commissions"],
    snippet: "Freelance illustrators in our survey reported a 22% drop in commissioned work since 2024, concentrated in stock and editorial illustration." },
  { kind: "web", url: "https://design-weekly.test/genai-studios", title: "Design studios fold generative tools into workflow", publisher: "Design Weekly", published: "2026-01-09",
    subtopic: "visual-arts", tags: ["design", "graphic", "studio", "visual", "workflow", "adoption"],
    snippet: "64% of mid-size design studios now use image generation for early concept work, but only 9% ship generated assets to clients unedited." },
  { kind: "web", url: "https://lensline.test/photo-provenance", title: "Photographers push for provenance labels", publisher: "Lensline", published: "2025-11-20",
    subtopic: "visual-arts", tags: ["photography", "photo", "provenance", "labels", "visual", "art"],
    snippet: "Three major photo agencies began requiring content-credential labels on submitted images in late 2025." },
  { kind: "web", url: "https://music-ledger.test/producers-ai-2026", title: "How producers use AI in 2026", publisher: "Music Ledger", published: "2026-02-02",
    subtopic: "music", tags: ["music", "producers", "audio", "songs", "adoption", "musicians"],
    snippet: "31% of working music producers say they use AI tools in at least half of their sessions, mostly for stem separation and mastering." },
  { kind: "web", url: "https://soundcheck-daily.test/ai-survey", title: "Survey: AI in the studio is mainstream, not majority", publisher: "Soundcheck Daily", published: "2026-02-18",
    subtopic: "music", tags: ["music", "producers", "survey", "audio", "adoption", "musicians"],
    snippet: "25% of producers use AI tools regularly, according to a survey of 1,200 studio professionals; vocal synthesis remains rare." },
  { kind: "web", url: "https://bookwire-news.test/ai-translation", title: "Publishers test machine translation for backlists", publisher: "Bookwire News", published: "2025-12-05",
    subtopic: "writing", tags: ["writing", "publishing", "books", "translation", "authors", "literature"],
    snippet: "Four mid-size publishers are piloting AI-assisted translation of backlist titles, with human translators paid to post-edit." },
  { kind: "web", url: "https://authors-bulletin.test/contracts", title: "AI clauses arrive in author contracts", publisher: "Authors Bulletin", published: "2026-04-01",
    subtopic: "writing", tags: ["writing", "authors", "contracts", "books", "training", "rights", "publishing"],
    snippet: "Most new trade-publishing contracts we reviewed now include a clause barring use of the manuscript for model training without consent." },
  { kind: "web", url: "https://reelfacts.test/vfx-genai", title: "Generative tools reach the VFX pipeline", publisher: "ReelFacts", published: "2026-05-22",
    subtopic: "film-tv", tags: ["film", "tv", "vfx", "movies", "studios", "production"],
    snippet: "VFX vendors report using generative fill for roto and cleanup on roughly a third of shots, cutting turnaround by about 30%." },
  { kind: "web", url: "https://screenlabor.test/guild-terms", title: "What the new guild terms say about digital replicas", publisher: "Screen Labor Report", published: "2025-10-30",
    subtopic: "film-tv", tags: ["film", "tv", "actors", "writers", "guild", "replicas", "labor"],
    snippet: "Current guild agreements require informed consent and separate pay for any digital replica of a performer." },
  { kind: "web", url: "https://playtest-mag.test/ai-npc", title: "Game studios and AI-driven characters", publisher: "Playtest Magazine", published: "2026-06-11",
    subtopic: "games", tags: ["games", "gaming", "npc", "dialogue", "studios", "voice"],
    snippet: "Two shipped titles now use model-generated NPC dialogue, both with human-written fallbacks for story-critical lines." },
];

export const DOCS: DocSource[] = [
  { kind: "doc", doc_id: "creative-economy-2026", title: "The Creative Economy and Generative AI: 2026 Report", publisher: "Institute for Creative Work", published: "2026-05-01",
    subtopic: "visual-arts", tags: ["report", "economy", "employment", "creative", "industries", "art", "music", "film"],
    pages: {
      4: "Employment: across the five creative sectors studied, total employment was flat (-1%) from 2024 to 2026, but the task mix shifted sharply toward editing and direction.",
      11: "Visual arts saw the largest income drop for freelancers (-18% median), while salaried in-house designers were largely unaffected.",
      17: "Music: adoption is highest in post-production (mastering, stem separation); use in composition is lower and contested.",
    } },
  { kind: "doc", doc_id: "screen-industries-paper", title: "Generative Models in Screen Production: A Field Study", publisher: "Journal of Media Production", published: "2026-02-15",
    subtopic: "film-tv", tags: ["paper", "film", "tv", "production", "vfx", "study"],
    pages: {
      2: "We observed 14 productions. Generative tools were used mainly in pre-visualisation and VFX cleanup, not in final principal imagery.",
      9: "Producers cited legal uncertainty over training data as the main reason for restricting use in final frames.",
    } },
];

/** Every id a finding can cite: web URLs and library doc_ids. */
export const ALL_SOURCE_IDS = [...WEB.map(w => w.url), ...DOCS.map(d => d.doc_id)];
