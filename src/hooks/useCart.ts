import { useCallback, useMemo, useState } from "react";
import {
  addProductToCart,
  getCartQuantity,
  readCartItems,
  removeCartItem,
  updateCartItemQuantity,
  writeCartItems,
  type CartItem,
} from "../lib/cartStorage";
import type { ProductColorId } from "../data/shop";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => readCartItems());

  const updateItems = useCallback((nextItems: CartItem[]) => {
    writeCartItems(nextItems);
    setItems(nextItems);
  }, []);

  const addItem = useCallback(
    (colorId: ProductColorId) => {
      setItems((currentItems) => {
        const nextItems = addProductToCart(currentItems, colorId);
        writeCartItems(nextItems);
        return nextItems;
      });
    },
    [],
  );

  const clearCart = useCallback(() => updateItems([]), [updateItems]);

  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    setItems((currentItems) => {
      const nextItems = updateCartItemQuantity(currentItems, itemId, quantity);
      writeCartItems(nextItems);
      return nextItems;
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((currentItems) => {
      const nextItems = removeCartItem(currentItems, itemId);
      writeCartItems(nextItems);
      return nextItems;
    });
  }, []);

  const quantity = useMemo(() => getCartQuantity(items), [items]);

  return {
    addItem,
    clearCart,
    items,
    quantity,
    removeItem,
    updateItemQuantity,
  };
}
