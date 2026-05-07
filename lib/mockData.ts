import type { Brand, Product } from "./types";

export const brands: Brand[] = [
  { id: "coca-cola", name: "Coca-Cola", color: "#E61A27", logoUrl: "/mock/brands/coca-cola.svg" },
  { id: "pepsi", name: "PepsiCo", color: "#004B93", logoUrl: "/mock/brands/pepsi.svg" },
  { id: "nestle", name: "Nestlé", color: "#5BB6E1", logoUrl: "/mock/brands/nestle.svg" },
  { id: "lays", name: "Lay's", color: "#F9C932", logoUrl: "/mock/brands/lays.svg" },
];

export const products: Product[] = [
  // Coca-Cola
  { id: "coke-can-330", brandId: "coca-cola", name: "Coke Can 330ml", sku: "CC-330", imageUrl: "/mock/products/can-coke.svg", widthMm: 66, heightMm: 115, depthMm: 66, category: "Cans" },
  { id: "coke-bottle-500", brandId: "coca-cola", name: "Coke 500ml", sku: "CC-500", imageUrl: "/mock/products/bottle-coke-500.svg", widthMm: 70, heightMm: 220, depthMm: 70, category: "Bottles" },
  { id: "coke-bottle-2l", brandId: "coca-cola", name: "Coke 2L", sku: "CC-2L", imageUrl: "/mock/products/bottle-coke-2l.svg", widthMm: 105, heightMm: 330, depthMm: 105, category: "Bottles" },
  { id: "sprite-can-330", brandId: "coca-cola", name: "Sprite 330ml", sku: "SP-330", imageUrl: "/mock/products/can-sprite.svg", widthMm: 66, heightMm: 115, depthMm: 66, category: "Cans" },
  { id: "fanta-can-330", brandId: "coca-cola", name: "Fanta 330ml", sku: "FA-330", imageUrl: "/mock/products/can-fanta.svg", widthMm: 66, heightMm: 115, depthMm: 66, category: "Cans" },
  // Pepsi
  { id: "pepsi-can-330", brandId: "pepsi", name: "Pepsi 330ml", sku: "PP-330", imageUrl: "/mock/products/can-pepsi.svg", widthMm: 66, heightMm: 115, depthMm: 66, category: "Cans" },
  { id: "pepsi-bottle-500", brandId: "pepsi", name: "Pepsi 500ml", sku: "PP-500", imageUrl: "/mock/products/bottle-pepsi-500.svg", widthMm: 70, heightMm: 220, depthMm: 70, category: "Bottles" },
  { id: "mountain-dew-330", brandId: "pepsi", name: "Mountain Dew 330ml", sku: "MD-330", imageUrl: "/mock/products/can-mtndew.svg", widthMm: 66, heightMm: 115, depthMm: 66, category: "Cans" },
  { id: "7up-330", brandId: "pepsi", name: "7UP 330ml", sku: "SU-330", imageUrl: "/mock/products/can-7up.svg", widthMm: 66, heightMm: 115, depthMm: 66, category: "Cans" },
  // Nestlé
  { id: "kitkat-4f", brandId: "nestle", name: "KitKat 4-finger", sku: "KK-4F", imageUrl: "/mock/products/box-kitkat.svg", widthMm: 90, heightMm: 130, depthMm: 18, category: "Confectionery" },
  { id: "nescafe-100g", brandId: "nestle", name: "Nescafé 100g", sku: "NC-100", imageUrl: "/mock/products/jar-nescafe.svg", widthMm: 75, heightMm: 130, depthMm: 75, category: "Beverages" },
  { id: "milkybar", brandId: "nestle", name: "Milkybar 25g", sku: "MB-25", imageUrl: "/mock/products/box-milkybar.svg", widthMm: 70, heightMm: 110, depthMm: 12, category: "Confectionery" },
  { id: "maggi-noodles", brandId: "nestle", name: "Maggi Noodles 70g", sku: "MN-70", imageUrl: "/mock/products/pack-maggi.svg", widthMm: 110, heightMm: 90, depthMm: 25, category: "Food" },
  // Lay's
  { id: "lays-classic", brandId: "lays", name: "Lay's Classic 52g", sku: "LC-52", imageUrl: "/mock/products/bag-lays-classic.svg", widthMm: 160, heightMm: 220, depthMm: 50, category: "Snacks" },
  { id: "lays-bbq", brandId: "lays", name: "Lay's BBQ 52g", sku: "LB-52", imageUrl: "/mock/products/bag-lays-bbq.svg", widthMm: 160, heightMm: 220, depthMm: 50, category: "Snacks" },
  { id: "lays-sourcream", brandId: "lays", name: "Lay's Sour Cream 52g", sku: "LS-52", imageUrl: "/mock/products/bag-lays-sour.svg", widthMm: 160, heightMm: 220, depthMm: 50, category: "Snacks" },
  { id: "lays-saltvinegar", brandId: "lays", name: "Lay's Salt & Vinegar 52g", sku: "LV-52", imageUrl: "/mock/products/bag-lays-saltvinegar.svg", widthMm: 160, heightMm: 220, depthMm: 50, category: "Snacks" },
];
