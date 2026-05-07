import { create } from "zustand";
import type { Brand, Product } from "../types";
import { brands as seedBrands, products as seedProducts } from "../mockData";

interface CatalogState {
  brands: Brand[];
  products: Product[];
  selectedBrandId: string | null;
  setSelectedBrand: (id: string | null) => void;
  getProductsForBrand: (brandId: string | null) => Product[];
  getProduct: (id: string) => Product | undefined;
  getBrand: (id: string) => Brand | undefined;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  brands: seedBrands,
  products: seedProducts,
  selectedBrandId: seedBrands[0]?.id ?? null,
  setSelectedBrand: (id) => set({ selectedBrandId: id }),
  getProductsForBrand: (brandId) => {
    if (!brandId) return get().products;
    return get().products.filter((p) => p.brandId === brandId);
  },
  getProduct: (id) => get().products.find((p) => p.id === id),
  getBrand: (id) => get().brands.find((b) => b.id === id),
}));
