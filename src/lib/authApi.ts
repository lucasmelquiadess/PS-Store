const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:3333" : "");

export type Gender = "masculino" | "feminino" | "nao-binario";

export type AuthUser = {
  fullName: string;
  email: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  birthDate: string;
  gender: Gender;
  phone: string;
  id: string;
};

export type EditableProfilePayload = Omit<AuthUser, "id" | "email" | "cpf">;

export type RegisterPayload = Omit<AuthUser, "id"> & {
  acceptedTerms: boolean;
  password: string;
  confirmPassword: string;
};

export type AccountAddress = {
  cep: string;
  city: string;
  complement: string;
  id: string;
  isPrimary: boolean;
  label: string;
  neighborhood: string;
  number: string;
  recipientName: string;
  state: string;
  street: string;
};

export type AddressPayload = Omit<AccountAddress, "id" | "isPrimary"> & {
  isPrimary?: boolean;
};

export type AccountOrderItem = {
  colorId: string;
  colorName: string;
  id: string;
  image: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
};

export type AccountOrder = {
  createdAt: string;
  deliveryAddress: AccountAddress;
  id: string;
  items: AccountOrderItem[];
  orderCode: string;
  paymentMethod: string;
  shippingCarrier: string;
  shippingEstimate: string;
  shippingPriceCents: number;
  status:
    | "realizado"
    | "pagamento_aprovado"
    | "nf_emitida"
    | "enviado"
    | "entregue";
  totalCents: number;
};

type AuthResponse = {
  user: AuthUser | null;
};

type ApiErrorResponse = {
  message?: string;
};

async function parseApiError(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorResponse;
    return payload.message ?? "Não foi possível concluir a operação.";
  } catch {
    return "Não foi possível concluir a operação.";
  }
}

async function requestAuth(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response;
}

export async function getCurrentUser() {
  const response = await requestAuth("/api/auth/me", { method: "GET" });
  const payload = (await response.json()) as AuthResponse;
  return payload.user;
}

export async function login(input: { email: string; password: string }) {
  const response = await requestAuth("/api/auth/login", {
    body: JSON.stringify(input),
    method: "POST",
  });
  const payload = (await response.json()) as AuthResponse;
  return payload.user;
}

export async function register(input: RegisterPayload) {
  const response = await requestAuth("/api/auth/register", {
    body: JSON.stringify(input),
    method: "POST",
  });
  const payload = (await response.json()) as AuthResponse;
  return payload.user;
}

export async function forgotPassword(email: string) {
  const response = await requestAuth("/api/auth/forgot-password", {
    body: JSON.stringify({ email }),
    method: "POST",
  });
  return (await response.json()) as { message: string };
}

export async function recoverEmailByCpf(cpf: string) {
  const response = await requestAuth("/api/auth/recover-email", {
    body: JSON.stringify({ cpf }),
    method: "POST",
  });
  return (await response.json()) as { email: string };
}

export async function updateProfile(input: EditableProfilePayload) {
  const response = await requestAuth("/api/auth/profile", {
    body: JSON.stringify(input),
    method: "PATCH",
  });
  const payload = (await response.json()) as AuthResponse;
  return payload.user;
}

export async function deleteProfile() {
  await requestAuth("/api/auth/profile", {
    method: "DELETE",
  });
}

export async function getAddresses() {
  const response = await requestAuth("/api/auth/addresses", { method: "GET" });
  return (await response.json()) as { addresses: AccountAddress[] };
}

export async function createAddress(input: AddressPayload) {
  const response = await requestAuth("/api/auth/addresses", {
    body: JSON.stringify(input),
    method: "POST",
  });
  return (await response.json()) as { address: AccountAddress };
}

export async function updateAddress(id: string, input: AddressPayload) {
  const response = await requestAuth(`/api/auth/addresses/${id}`, {
    body: JSON.stringify(input),
    method: "PATCH",
  });
  return (await response.json()) as { address: AccountAddress };
}

export async function deleteAddress(id: string) {
  await requestAuth(`/api/auth/addresses/${id}`, {
    method: "DELETE",
  });
}

export async function setPrimaryAddress(id: string) {
  const response = await requestAuth(`/api/auth/addresses/${id}/primary`, {
    body: JSON.stringify({}),
    method: "POST",
  });
  return (await response.json()) as { address: AccountAddress };
}

export async function getOrders() {
  const response = await requestAuth("/api/auth/orders", { method: "GET" });
  return (await response.json()) as { orders: AccountOrder[] };
}

export async function logout() {
  await requestAuth("/api/auth/logout", {
    body: JSON.stringify({}),
    method: "POST",
  });
}
