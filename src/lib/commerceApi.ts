import type { CartItem } from "./cartStorage";
import type { AccountOrder } from "./authApi";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:3333" : "");

export type PostalAddress = {
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type ShippingOption = {
  id: string;
  name: string;
  carrier: string;
  estimate: string;
  priceCents: number;
};

export type ShippingQuote = {
  address: PostalAddress;
  options: ShippingOption[];
};

export type CheckoutResult = {
  order?: AccountOrder;
  orderId: string;
  status: "approved";
  message: string;
};

type ApiErrorResponse = {
  message?: string;
};

function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "").slice(0, 8);
}

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.message ?? "Não foi possível concluir a operação.";
  } catch {
    return "Não foi possível concluir a operação.";
  }
}

export async function getShippingQuote(cep: string, signal?: AbortSignal) {
  const cleanCep = normalizeCep(cep);
  const response = await fetch(`${API_BASE_URL}/api/shipping?cep=${cleanCep}`, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as ShippingQuote;
}

export async function createCheckout(input: {
  addressId?: string;
  cep: string;
  items: CartItem[];
  paymentMethod?: string;
  shippingOptionId: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/checkout`, {
    credentials: "include",
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cep: normalizeCep(input.cep),
      addressId: input.addressId,
      items: input.items.map((item) => ({
        colorId: item.colorId,
        productId: item.productId,
        quantity: item.quantity,
      })),
      paymentMethod: input.paymentMethod,
      shippingOptionId: input.shippingOptionId,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as CheckoutResult;
}
