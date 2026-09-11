import type { TenantProduct } from "./types";

/** Fold a product name down to comparable words: case, underscores, hyphens,
 *  brackets and stray punctuation all stop mattering. Lets a user type
 *  "chupa chups bubbly lollipop 16 gms" and hit
 *  `CHUPA_CHUPS_BUBBLY_LOLLIPOP_16_GMS`. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export interface NameMatch {
  /** The word the user typed, unchanged — for reporting what failed. */
  input: string;
  product: TenantProduct | null;
  /** True when more than one product matched and none matched exactly. */
  ambiguous: boolean;
}

/**
 * Resolve a typed product name against the catalog, in order of confidence:
 * exact (normalized) → unique prefix → unique substring. Anything that matches
 * several products without an exact hit is reported ambiguous rather than
 * guessed at, because picking the wrong SKU silently is worse than skipping it.
 */
export function matchProductName(input: string, catalog: TenantProduct[]): NameMatch {
  const q = normalizeName(input);
  if (!q) return { input, product: null, ambiguous: false };

  const exact = catalog.filter((p) => normalizeName(p.itemDescription) === q);
  if (exact.length > 0) return { input, product: exact[0], ambiguous: false };

  const prefix = catalog.filter((p) => normalizeName(p.itemDescription).startsWith(q));
  if (prefix.length === 1) return { input, product: prefix[0], ambiguous: false };
  if (prefix.length > 1) return { input, product: null, ambiguous: true };

  const contains = catalog.filter((p) => normalizeName(p.itemDescription).includes(q));
  if (contains.length === 1) return { input, product: contains[0], ambiguous: false };
  return { input, product: null, ambiguous: contains.length > 1 };
}

/** One typed entry on a shelf line: the product name plus how many facings of
 *  it were asked for. */
export interface ParsedShelfItem {
  /** The product name as typed, with any quantity suffix removed. */
  name: string;
  /** Facings requested. 1 when no quantity was typed. */
  qty: number;
}

export interface ParsedShelfLine {
  /** 1-based shelf number this line targets. */
  shelfNo: number;
  items: ParsedShelfItem[];
}

/**
 * Split a trailing facing count off a typed entry: `NAME x4`, `NAME X4`,
 * `NAME ×4`, `NAME *4` or `NAME (4)`, with or without the space.
 *
 * Anchored at the end of the string and requiring the marker, so pack sizes
 * inside a name survive untouched — `MENTOS_FRESH_DIVE_GUM_GRAPE_44Px2GM` keeps
 * its `x2`, and `..._87.5GM 50p` its `50p`. Verified against the whole
 * 167-row Choithrams catalog: no product name is altered by this.
 */
function splitQty(raw: string): ParsedShelfItem {
  const s = raw.trim();
  const m = /^(.*?)\s*(?:[x×*]\s*(\d{1,3})|\((\d{1,3})\))$/i.exec(s);
  if (!m) return { name: s, qty: 1 };
  const name = m[1].trim();
  const n = Number(m[2] ?? m[3]);
  // A bare `x4` with nothing in front of it is not a product — keep the raw
  // text so it gets reported as unmatched rather than silently dropped.
  if (!name || !Number.isFinite(n) || n < 1) return { name: s, qty: 1 };
  return { name, qty: n };
}

/**
 * Parse the shelf-builder textarea. One shelf per line:
 *   `Shelf 1: RAINBOW EVAP ORIGINAL 170g, RAINBOW EVAP PET 133ml x3`
 * The `Shelf N:` prefix is optional — without it the line's position decides
 * the shelf, so a bare paste of comma-separated lines still works. A trailing
 * quantity on an entry means that many facings; repeating the same name is
 * equivalent and collapses to the same thing when the shelf is built.
 */
export function parseShelfLines(text: string): ParsedShelfLine[] {
  const out: ParsedShelfLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^shelf\s*(\d+)\s*[:.\-]\s*(.*)$/i.exec(line);
    const shelfNo = m ? Number(m[1]) : out.length + 1;
    const rest = m ? m[2] : line;
    const items = rest
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map(splitQty);
    out.push({ shelfNo, items });
  }
  return out;
}
