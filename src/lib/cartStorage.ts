import {
  getProductColorOption,
  shopProduct,
  type ProductColorId,
} from "../data/shop";

const CART_STORAGE_KEY = "dualsense-edge-cart-v2";

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  colorId: ProductColorId;
  colorName: string;
  image: string;
  unitPriceCents: number;
  quantity: number;
};

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as CartItem;
  return (
    item.productId === shopProduct.id &&
    (item.colorId === "white" || item.colorId === "midnight") &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= 10
  );
}

function normalizeCartItem(item: CartItem): CartItem {
  const color = getProductColorOption(item.colorId);

  return {
    id: `${shopProduct.id}-${color.id}`,
    productId: shopProduct.id,
    productName: shopProduct.name,
    colorId: color.id,
    colorName: color.name,
    image: color.image,
    unitPriceCents: shopProduct.priceCents,
    quantity: Math.min(item.quantity, 10),
  };
}

export function readCartItems(): CartItem[] {
  const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);

  if (!rawCart) {
    return [];
  }

  try {
    const parsedCart = JSON.parse(rawCart);
    return Array.isArray(parsedCart)
      ? parsedCart.filter(isCartItem).map(normalizeCartItem)
      : [];
  } catch {
    return [];
  }
}

export function writeCartItems(items: CartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function addProductToCart(items: CartItem[], colorId: ProductColorId) {
  const color = getProductColorOption(colorId);
  const itemId = `${shopProduct.id}-${color.id}`;
  const existingItem = items.find((item) => item.id === itemId);

  if (existingItem) {
    return items.map((item) =>
      item.id === itemId
        ? { ...item, quantity: Math.min(item.quantity + 1, 10) }
        : item,
    );
  }

  return [
    ...items,
    {
      id: itemId,
      productId: shopProduct.id,
      productName: shopProduct.name,
      colorId: color.id,
      colorName: color.name,
      image: color.image,
      unitPriceCents: shopProduct.priceCents,
      quantity: 1,
    },
  ];
}

export function updateCartItemQuantity(
  items: CartItem[],
  itemId: string,
  quantity: number,
) {
  if (quantity <= 0) {
    return removeCartItem(items, itemId);
  }

  return items.map((item) =>
    item.id === itemId
      ? { ...item, quantity: Math.min(Math.max(quantity, 1), 10) }
      : item,
  );
}

export function removeCartItem(items: CartItem[], itemId: string) {
  return items.filter((item) => item.id !== itemId);
}

export function getCartQuantity(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function getCartSubtotalCents(items: CartItem[]) {
  return items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
}
