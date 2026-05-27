import { productAssets } from "./product";

export type ProductColorId = "white" | "midnight";

export type ProductColorOption = {
  id: ProductColorId;
  name: string;
  image: string;
  swatch: string;
};

export const shopProduct = {
  id: "dualsense-edge",
  name: "Controle sem fio DualSense Edge",
  priceCents: 129999,
  shortDescription:
    "Controle profissional para PS5 com perfis rápidos, gatilhos ajustáveis e componentes modulares.",
};

export const productColorOptions: ProductColorOption[] = [
  {
    id: "white",
    name: "Branco",
    image: productAssets.whiteProduct,
    swatch: "#f7f8fc",
  },
  {
    id: "midnight",
    name: "Midnight Black",
    image: productAssets.midnightProduct,
    swatch: "#111827",
  },
];

export function getProductColorOption(colorId: ProductColorId) {
  return (
    productColorOptions.find((option) => option.id === colorId) ??
    productColorOptions[0]
  );
}
