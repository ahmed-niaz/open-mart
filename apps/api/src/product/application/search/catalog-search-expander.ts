/**
 * Multilingual / Banglish / Phonetic Catalog Search Expander.
 *
 * Translates common Romanized Bengali ("Banglish"), Bengali script, and phonetic
 * spelling variations into bounded search term candidates consumed by PostgreSQL
 * `pg_trgm` trigram similarity and substring queries.
 */

export interface ExpandedCatalogSearch {
  primaryTerm: string;
  expandedTerms: string[];
  trigramTerms: string[];
  tokens: string[];
}

/**
 * Bidirectional synonym clusters mapping English, Banglish, and Bengali script
 * terms within the same semantic group. Keep each cluster concise to avoid
 * overly broad matches.
 */
const BANGLISH_SYNONYM_CLUSTERS: ReadonlyArray<ReadonlyArray<string>> = [
  // Apparel & Traditional Wear
  ['panjabi', 'punjabi', 'পাঞ্জাবি'],
  ['saree', 'sari', 'sharee', 'shari', 'শাড়ি', 'শাড়ি'],
  ['t-shirt', 't-shart', 'tshart', 'tshirt', 't shirt', 'টিশার্ট'],
  ['shirt', 'shart', 'শার্ট'],
  ['pant', 'pajama', 'payjama', 'pyjama', 'প্যান্ট', 'পায়জামা'],
  ['kamiz', 'kameez', 'salwar', 'কামিজ', 'সালোয়ার'],
  ['lungi', 'longi', 'লুঙ্গি'],
  ['jacket', 'jaket', 'জ্যাকেট'],
  ['hoodie', 'hudi', 'হুডি'],
  ['shoe', 'shoes', 'juta', 'জুতা'],
  ['watch', 'ghori', 'ঘড়ি'],
  ['sunglass', 'chasma', 'choshma', 'glasses', 'চশমা'],
  ['bag', 'bosta', 'backpack', 'ব্যাগ'],

  // Electronics & Audio
  ['headphone', 'hedphone', 'headfon', 'hedfon', 'হেডফোন'],
  ['earbud', 'earbuds', 'erbud', 'earphone', 'ইয়ারফোন', 'ইয়ারবাড'],
  ['speaker', 'speker', 'স্পিকার'],
  ['charger', 'charjar', 'adapter', 'চার্জার'],
  ['powerbank', 'power bank', 'powarbank', 'পাওয়ারব্যাংক'],
  ['camera', 'camra', 'cemera', 'ক্যামেরা'],
  ['tv', 'television', 'টিভি'],
  ['phone', 'mobile', 'mobail', 'ফোন', 'মোবাইল'],

  // Computers & Peripherals
  ['laptop', 'laptob', 'leptop', 'ল্যাপটপ'],
  ['computer', 'komputer', 'pc', 'desktop', 'কম্পিউটার'],
  ['monitor', 'moniter', 'display', 'মনিটর'],
  ['keyboard', 'kibord', 'keybord', 'কীবোর্ড'],
  ['mouse', 'maus', 'mous', 'মাউস'],
  ['router', 'rautar', 'wifi', 'রাউটার'],
  ['ssd', 'hdd', 'storage', 'hard disk'],

  // Smart Home
  ['light', 'bulb', 'balb', 'lamp', 'লাইট', 'বাল্ব'],
  ['fan', 'fyan', 'ফ্যান'],
  ['lock', 'tala', 'smart lock', 'তালা'],
  ['cctv', 'security camera', 'ip camera'],

  // Arts & Crafts
  ['paint', 'color', 'rong', 'রং'],
  ['brush', 'tuli', 'ব্রাশ', 'তুলি'],
  ['paper', 'kagoj', 'কাগজ'],
  ['canvas', 'ক্যানভাস'],

  // Automotive
  ['car', 'gari', 'গাড়ি'],
  ['bike', 'baik', 'motorcycle', 'বাইক', 'মোটরসাইকেল'],
  ['helmet', 'হেলমেট'],
  ['dashcam', 'dash cam'],
];

const SYNONYM_LOOKUP: ReadonlyMap<string, ReadonlyArray<string>> = (() => {
  const map = new Map<string, ReadonlyArray<string>>();
  for (const cluster of BANGLISH_SYNONYM_CLUSTERS) {
    const normalizedCluster = cluster.map((item) => normalizeRawSearch(item));
    for (const term of normalizedCluster) {
      if (!term) continue;
      const existing = map.get(term) ?? [];
      const merged = Array.from(
        new Set([...existing, ...normalizedCluster.filter((t) => t !== term)]),
      );
      map.set(term, merged);
    }
  }
  return map;
})();

const MAX_EXPANDED_TERMS = 8;

/**
 * Normalizes Unicode composition, whitespace, and casing while preserving Bengali script.
 */
export function normalizeRawSearch(input: string): string {
  return input.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function generatePhoneticVariants(term: string): string[] {
  const variants = new Set<string>();

  // Hyphen / space normalization (e.g. "t-shart" -> "t shart", "tshart")
  if (term.includes('-') || term.includes(' ')) {
    variants.add(term.replace(/-/g, ' ').replace(/\s+/g, ' ').trim());
    variants.add(term.replace(/[-\s]+/g, ''));
  }

  // Only apply Romanized Latin phonetic substitutions to ASCII-like terms
  if (/^[a-z0-9\s-]+$/.test(term) && term.length >= 3) {
    const rules: Array<[RegExp, string]> = [
      [/ph/g, 'f'],
      [/f/g, 'ph'],
      [/oo/g, 'u'],
      [/ee/g, 'i'],
      [/sh/g, 's'],
      [/k/g, 'c'],
      [/c(?=[aou])/g, 'k'],
    ];

    for (const [pattern, replacement] of rules) {
      const candidate = term.replace(pattern, replacement);
      if (candidate !== term && candidate.length >= 3) {
        variants.add(candidate);
      }
    }
  }

  return Array.from(variants);
}

/**
 * Produces a bounded list of search terms prioritizing exact user query first,
 * followed by Banglish/Bengali/English synonyms and lightweight phonetic variants.
 */
export function expandCatalogSearchTerms(
  rawQuery: string,
): ExpandedCatalogSearch {
  const primaryTerm = normalizeRawSearch(rawQuery);
  if (!primaryTerm) {
    return {
      primaryTerm: '',
      expandedTerms: [],
      trigramTerms: [],
      tokens: [],
    };
  }

  const orderedTerms = new Set<string>([primaryTerm]);
  const tokens = primaryTerm
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const addCandidate = (candidate: string) => {
    const normalized = normalizeRawSearch(candidate);
    if (!normalized || orderedTerms.size >= MAX_EXPANDED_TERMS) return;
    orderedTerms.add(normalized);
  };

  // 1. Direct cluster lookup for full query and space/hyphen-normalized forms
  const compactPrimary = primaryTerm.replace(/[-\s]+/g, '');
  const spacedPrimary = primaryTerm.replace(/-/g, ' ');
  for (const probe of [primaryTerm, spacedPrimary, compactPrimary]) {
    const synonyms = SYNONYM_LOOKUP.get(probe);
    if (synonyms) {
      for (const syn of synonyms) {
        addCandidate(syn);
      }
    }
  }

  // 2. Per-token synonym lookup (useful for multi-word queries like "cotton panjabi")
  for (const token of tokens) {
    const synonyms = SYNONYM_LOOKUP.get(token);
    if (synonyms) {
      for (const syn of synonyms) {
        if (tokens.length > 1) {
          addCandidate(primaryTerm.replace(token, syn));
        }
        addCandidate(syn);
      }
    }
  }

  // 3. Phonetic / punctuation variants of primary term
  for (const phonetic of generatePhoneticVariants(primaryTerm)) {
    addCandidate(phonetic);
  }

  const expandedTerms = Array.from(orderedTerms);
  const trigramTerms = expandedTerms.filter((t) => t.length >= 3);

  return {
    primaryTerm,
    expandedTerms,
    trigramTerms,
    tokens,
  };
}
