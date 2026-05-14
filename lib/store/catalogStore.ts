import { create } from "zustand";
import type { Product } from "../types";
import type { TenantProduct } from "../catalog/types";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
       <rect width="64" height="64" rx="8" fill="#e2e8f0"/>
       <path d="M16 44h32M16 36l8-8 6 6 8-10 8 12" stroke="#94a3b8" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     </svg>`,
  );

const DEFAULT_DIM_MM = 100;

/**
 * Convert a `TenantProduct` (DB row) into the editor-shape `Product` that
 * the canvas, arrangement maths, and placement modals consume.
 */
export function toEditorProduct(t: TenantProduct): Product {
  const dims = t.itemDimensions;
  return {
    id: t.productId,
    name: t.itemDescription,
    sku: t.itemCode,
    mainBrand: t.mainBrand,
    subBrand: t.subBrand,
    category: t.category,
    uom: t.uom,
    imageUrl: t.itemImageUrl ? `/api/catalog/image/${t.itemImageUrl}` : PLACEHOLDER_IMAGE,
    widthMm: dims?.widthMm ?? DEFAULT_DIM_MM,
    heightMm: dims?.heightMm ?? DEFAULT_DIM_MM,
  };
}

/** Deterministic accent colour from a brand name for chips/labels. */
export function brandAccentColor(brand: string): string {
  let h = 0;
  for (let i = 0; i < brand.length; i++) {
    h = (h * 31 + brand.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue} 65% 45%)`;
}

interface CatalogState {
  products: TenantProduct[];
  loaded: boolean;

  categoryFilter: string | null;
  brandFilter: string | null;
  subBrandFilter: string | null;
  productSearch: string;
  categorySearch: string;
  brandSearch: string;
  subBrandSearch: string;

  setProducts: (p: TenantProduct[]) => void;
  setLoaded: (b: boolean) => void;
  upsertProduct: (p: TenantProduct) => void;
  removeProduct: (productId: string) => void;

  setCategoryFilter: (c: string | null) => void;
  setBrandFilter: (b: string | null) => void;
  setSubBrandFilter: (b: string | null) => void;
  setProductSearch: (q: string) => void;
  setCategorySearch: (q: string) => void;
  setBrandSearch: (q: string) => void;
  setSubBrandSearch: (q: string) => void;

  /** Return the editor-shape Product for a placement to consume. */
  getProduct: (productId: string) => Product | undefined;
  /** Return the raw TenantProduct row. */
  getRawProduct: (productId: string) => TenantProduct | undefined;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  loaded: false,
  categoryFilter: null,
  brandFilter: null,
  subBrandFilter: null,
  productSearch: "",
  categorySearch: "",
  brandSearch: "",
  subBrandSearch: "",

  setProducts: (p) => set({ products: p, loaded: true }),
  setLoaded: (b) => set({ loaded: b }),
  upsertProduct: (p) =>
    set((s) => {
      const idx = s.products.findIndex((x) => x.productId === p.productId);
      if (idx === -1) return { products: [p, ...s.products] };
      const next = s.products.slice();
      next[idx] = p;
      return { products: next };
    }),
  removeProduct: (productId) =>
    set((s) => ({ products: s.products.filter((p) => p.productId !== productId) })),

  setCategoryFilter: (c) => set({ categoryFilter: c }),
  setBrandFilter: (b) => set({ brandFilter: b }),
  setSubBrandFilter: (b) => set({ subBrandFilter: b }),
  setProductSearch: (q) => set({ productSearch: q }),
  setCategorySearch: (q) => set({ categorySearch: q }),
  setBrandSearch: (q) => set({ brandSearch: q }),
  setSubBrandSearch: (q) => set({ subBrandSearch: q }),

  getProduct: (productId) => {
    const t = get().products.find((p) => p.productId === productId);
    return t ? toEditorProduct(t) : undefined;
  },
  getRawProduct: (productId) => get().products.find((p) => p.productId === productId),
}));
