const CART_CEP_SESSION_KEY = "dualsense-edge-cart-cep-v2";
const PENDING_CHECKOUT_SESSION_KEY = "dualsense-edge-pending-checkout-v2";

export type PendingCheckout = {
  cep: string;
  shippingOptionId: string;
};

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function readCartCep() {
  return getSessionStorage()?.getItem(CART_CEP_SESSION_KEY) ?? "";
}

export function saveCartCep(cep: string) {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  if (!cep) {
    storage.removeItem(CART_CEP_SESSION_KEY);
    return;
  }

  storage.setItem(CART_CEP_SESSION_KEY, normalizeCep(cep));
}

export function readPendingCheckout(): PendingCheckout | null {
  const rawValue = getSessionStorage()?.getItem(PENDING_CHECKOUT_SESSION_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PendingCheckout>;
    const cep = normalizeCep(parsed.cep ?? "");

    if (!cep || !parsed.shippingOptionId) {
      return null;
    }

    return {
      cep,
      shippingOptionId: parsed.shippingOptionId,
    };
  } catch {
    return null;
  }
}

export function savePendingCheckout(input: PendingCheckout) {
  getSessionStorage()?.setItem(
    PENDING_CHECKOUT_SESSION_KEY,
    JSON.stringify({
      cep: normalizeCep(input.cep),
      shippingOptionId: input.shippingOptionId,
    }),
  );
}

export function clearPendingCheckout() {
  getSessionStorage()?.removeItem(PENDING_CHECKOUT_SESSION_KEY);
}
