import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  authenticateUserDetailed,
  createUserAddress,
  createUserOrder,
  createSession,
  createUser,
  deleteUserAddress,
  deleteUserAccount,
  deleteSession,
  findEmailByCpf,
  findUserAddress,
  findUserByEmail,
  findUserBySessionToken,
  getPasswordStrength,
  isValidCpf,
  listUserAddresses,
  listUserOrders,
  normalizeEmail,
  normalizeState,
  setUserPrimaryAddress,
  updateUserAddress,
  updateUserProfile,
  validateBirthDate,
  type AddressInput,
  type EditableProfileInput,
  type RegisterInput,
} from "./authDb.js";

type ApiAddress = {
  cep: string;
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};

type CheckoutItem = {
  colorId: string;
  productId: string;
  quantity: number;
};

type CepProvider = {
  name: string;
  url: (cep: string) => string;
  isNotFound?: (payload: Record<string, unknown>) => boolean;
  mapAddress: (payload: Record<string, unknown>) => ApiAddress;
};

type HttpError = Error & {
  headers?: Record<string, string>;
  statusCode?: number;
};

type CheckoutPaymentMethod = "Cartões de crédito" | "PIX";
type RateLimitScope = "checkout" | "login" | "recovery" | "register" | "shipping";

const PORT = Number(process.env.PORT ?? 3333);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const USE_LOCAL_CEP = process.env.STORE_CEP_MODE === "local";
const REQUEST_BODY_LIMIT_BYTES = 64 * 1024;
const FAILED_AUTH_DELAY_MS = 300;
const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:3333",
  "http://localhost:3333",
]);
const BRAZILIAN_STATES = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com(?:\.br)?$/i;
const PHONE_PATTERN = /^\(\d{2}\) 9\d{4}-\d{4}$/;
const PASSWORD_REQUIREMENTS_MESSAGE =
  "A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial.";
const FIELD_LIMITS = {
  birthDate: 10,
  cep: 9,
  city: 100,
  complement: 120,
  confirmPassword: 128,
  cpf: 14,
  email: 254,
  fullName: 120,
  gender: 20,
  label: 60,
  neighborhood: 100,
  number: 24,
  password: 128,
  phone: 15,
  recipientName: 120,
  state: 2,
  street: 160,
} as const;
const RATE_LIMITS: Record<
  RateLimitScope,
  { maxRequests: number; windowMs: number }
> = {
  checkout: { maxRequests: 20, windowMs: 15 * 60 * 1000 },
  login: { maxRequests: 8, windowMs: 15 * 60 * 1000 },
  recovery: { maxRequests: 6, windowMs: 15 * 60 * 1000 },
  register: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  shipping: { maxRequests: 60, windowMs: 15 * 60 * 1000 },
};
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const CEP_FALLBACK_REGIONS = [
  { max: 19999999, min: 1000000, city: "São Paulo", state: "SP" },
  { max: 28999999, min: 20000000, city: "Rio de Janeiro", state: "RJ" },
  { max: 29999999, min: 29000000, city: "Vitória", state: "ES" },
  { max: 39999999, min: 30000000, city: "Belo Horizonte", state: "MG" },
  { max: 48999999, min: 40000000, city: "Salvador", state: "BA" },
  { max: 49999999, min: 49000000, city: "Aracaju", state: "SE" },
  { max: 56999999, min: 50000000, city: "Recife", state: "PE" },
  { max: 57999999, min: 57000000, city: "Maceió", state: "AL" },
  { max: 58999999, min: 58000000, city: "João Pessoa", state: "PB" },
  { max: 59999999, min: 59000000, city: "Natal", state: "RN" },
  { max: 63999999, min: 60000000, city: "Fortaleza", state: "CE" },
  { max: 64999999, min: 64000000, city: "Teresina", state: "PI" },
  { max: 65999999, min: 65000000, city: "São Luís", state: "MA" },
  { max: 68899999, min: 66000000, city: "Belém", state: "PA" },
  { max: 68999999, min: 68900000, city: "Macapá", state: "AP" },
  { max: 69299999, min: 69000000, city: "Manaus", state: "AM" },
  { max: 69399999, min: 69300000, city: "Boa Vista", state: "RR" },
  { max: 69999999, min: 69400000, city: "Rio Branco", state: "AC" },
  { max: 72799999, min: 70000000, city: "Brasília", state: "DF" },
  { max: 76799999, min: 72800000, city: "Goiânia", state: "GO" },
  { max: 77999999, min: 77000000, city: "Palmas", state: "TO" },
  { max: 78899999, min: 78000000, city: "Cuiabá", state: "MT" },
  { max: 79999999, min: 79000000, city: "Campo Grande", state: "MS" },
  { max: 87999999, min: 80000000, city: "Curitiba", state: "PR" },
  { max: 89999999, min: 88000000, city: "Florianópolis", state: "SC" },
  { max: 99999999, min: 90000000, city: "Porto Alegre", state: "RS" },
];
const CEP_PROVIDERS: CepProvider[] = [
  {
    isNotFound: (payload) => payload.erro === true,
    mapAddress: mapViaCepAddress,
    name: "ViaCEP",
    url: (cep) => `https://viacep.com.br/ws/${cep}/json/`,
  },
  {
    mapAddress: mapBrasilApiAddress,
    name: "BrasilAPI",
    url: (cep) => `https://brasilapi.com.br/api/cep/v1/${cep}`,
  },
  {
    isNotFound: (payload) => payload.erro === true,
    mapAddress: mapOpenCepAddress,
    name: "OpenCEP",
    url: (cep) => `https://opencep.com/v1/${cep}.json`,
  },
];
const SHOP_PRODUCT = {
  id: "dualsense-edge",
  name: "Controle sem fio DualSense Edge",
  priceCents: 129999,
};
const SHOP_COLORS: Record<string, { image: string; name: string }> = {
  midnight: {
    image: "/images/produto-midnight-black.jpg",
    name: "Midnight Black",
  },
  white: {
    image: "/images/produto-branco.jpg",
    name: "Branco",
  },
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(projectRoot, process.env.CLIENT_OUT_DIR ?? "build");

function createHttpError(
  statusCode: number,
  message: string,
  headers?: Record<string, string>,
): HttpError {
  const error = new Error(message) as HttpError;
  error.headers = headers;
  error.statusCode = statusCode;
  return error;
}

function normalizeCep(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function validateCep(value: string | null) {
  const cep = normalizeCep(value);

  if (!/^\d{8}$/.test(cep)) {
    throw createHttpError(400, "Informe um CEP válido com 8 números.");
  }

  return cep;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getClientIdentifier(request: IncomingMessage) {
  return request.socket.remoteAddress ?? "unknown";
}

function cleanupRateLimitBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

function enforceRateLimit(
  request: IncomingMessage,
  scope: RateLimitScope,
  subject = "",
) {
  const config = RATE_LIMITS[scope];
  const now = Date.now();
  cleanupRateLimitBuckets(now);

  const normalizedSubject = subject
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "")
    .slice(0, 80);
  const key = [
    scope,
    getClientIdentifier(request),
    normalizedSubject || "anonymous",
  ].join(":");
  const bucket =
    rateLimitBuckets.get(key) ?? {
      count: 0,
      resetAt: now + config.windowMs,
    };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (bucket.count > config.maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );

    throw createHttpError(
      429,
      "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
      { "Retry-After": String(retryAfterSeconds) },
    );
  }
}

function assertTrustedOrigin(request: IncomingMessage) {
  if (!["POST", "PATCH", "DELETE"].includes(request.method ?? "")) {
    return;
  }

  const origin = request.headers.origin;

  if (!origin) {
    return;
  }

  if (!ALLOWED_ORIGINS.has(origin)) {
    throw createHttpError(403, "Origem da requisição não autorizada.");
  }
}

function assertFieldMaxLengths(
  input: Record<string, unknown>,
  limits: Partial<Record<keyof typeof FIELD_LIMITS, number>>,
) {
  for (const [field, maxLength] of Object.entries(limits)) {
    const value = input[field];

    if (typeof value === "string" && value.length > maxLength) {
      throw createHttpError(
        400,
        "Revise os campos enviados; há valores acima do limite permitido.",
      );
    }
  }
}

function setSecurityHeaders(response: ServerResponse) {
  response.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' https://gmedia.playstation.com data:",
    "media-src https://gmedia.playstation.com",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' http://127.0.0.1:3333 http://localhost:3333 https://viacep.com.br",
  ].join("; "));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");

  if (IS_PRODUCTION) {
    response.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  }
}

function setCorsHeaders(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
  response.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  setSecurityHeaders(response);
  setCorsHeaders(request, response);
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const contentType = String(request.headers["content-type"] ?? "").toLowerCase();

  if (!contentType.startsWith("application/json")) {
    throw createHttpError(415, "Envie o corpo da requisição como JSON.");
  }

  let rawBody = "";

  for await (const chunk of request) {
    rawBody += chunk;

    if (Buffer.byteLength(rawBody) > REQUEST_BODY_LIMIT_BYTES) {
      throw createHttpError(413, "Payload muito grande.");
    }
  }

  try {
    return JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    throw createHttpError(400, "JSON inválido.");
  }
}

function getCookie(request: IncomingMessage, name: string) {
  const rawCookie = request.headers.cookie ?? "";
  const cookies = rawCookie.split(";").map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!target) {
    return null;
  }

  return decodeURIComponent(target.slice(name.length + 1));
}

function setSessionCookie(
  response: ServerResponse,
  token: string,
  _maxAgeSeconds: number,
) {
  const attributes = [
    `ds_session=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
  ];

  if (IS_PRODUCTION) {
    attributes.push("Secure");
  }

  response.setHeader(
    "Set-Cookie",
    attributes.join("; "),
  );
}

function clearSessionCookie(response: ServerResponse) {
  const attributes = [
    "ds_session=",
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (IS_PRODUCTION) {
    attributes.push("Secure");
  }

  response.setHeader(
    "Set-Cookie",
    attributes.join("; "),
  );
}

function getAuthenticatedUser(request: IncomingMessage) {
  const user = findUserBySessionToken(getCookie(request, "ds_session"));

  if (!user) {
    throw createHttpError(401, "Faça login para continuar.");
  }

  return user;
}

function getString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function validateEmail(email: string) {
  return EMAIL_PATTERN.test(email);
}

function validatePhone(phone: string) {
  return PHONE_PATTERN.test(phone);
}

function isBrazilianState(state: string) {
  return BRAZILIAN_STATES.has(state);
}

function validateRegisterPayload(payload: Record<string, unknown>): RegisterInput {
  const input = {
    birthDate: getString(payload, "birthDate"),
    cep: getString(payload, "cep"),
    city: getString(payload, "city"),
    complement: getString(payload, "complement"),
    confirmPassword: getString(payload, "confirmPassword"),
    cpf: getString(payload, "cpf"),
    email: normalizeEmail(getString(payload, "email")),
    fullName: getString(payload, "fullName"),
    gender: getString(payload, "gender"),
    neighborhood: getString(payload, "neighborhood"),
    number: getString(payload, "number"),
    password: getString(payload, "password"),
    phone: getString(payload, "phone"),
    state: normalizeState(getString(payload, "state")),
    street: getString(payload, "street"),
  } as RegisterInput;

  assertFieldMaxLengths(input, FIELD_LIMITS);

  if (input.fullName.length < 3 || !input.fullName.includes(" ")) {
    throw createHttpError(400, "Informe o nome completo.");
  }

  if (!validateEmail(input.email)) {
    throw createHttpError(400, "Digite um e-mail válido.");
  }

  if (!isValidCpf(input.cpf)) {
    throw createHttpError(400, "Informe um CPF válido no formato 000.000.000-00.");
  }

  if (!/^\d{8}$/.test(normalizeCep(input.cep))) {
    throw createHttpError(400, "Informe um CEP válido com 8 números.");
  }

  if (
    !input.street ||
    !input.number ||
    !input.neighborhood ||
    !input.city ||
    !isBrazilianState(input.state)
  ) {
    throw createHttpError(400, "Informe o endereço completo.");
  }

  if (!validateBirthDate(input.birthDate)) {
    throw createHttpError(400, "Informe uma data de nascimento válida.");
  }

  if (!["masculino", "feminino", "nao-binario"].includes(input.gender)) {
    throw createHttpError(400, "Selecione uma opção de sexo válida.");
  }

  if (!validatePhone(input.phone)) {
    throw createHttpError(400, "Informe um celular válido no formato (21) 99999-9999.");
  }

  if (input.password !== input.confirmPassword) {
    throw createHttpError(400, "A confirmação de senha não confere.");
  }

  if (payload.acceptedTerms !== true) {
    throw createHttpError(400, "Aceite os termos de uso para concluir o cadastro.");
  }

  if (getPasswordStrength(input.password) === "fraca") {
    throw createHttpError(400, PASSWORD_REQUIREMENTS_MESSAGE);
  }

  return input;
}

function validateEditableProfilePayload(payload: Record<string, unknown>): EditableProfileInput {
  const input = {
    birthDate: getString(payload, "birthDate"),
    cep: getString(payload, "cep"),
    city: getString(payload, "city"),
    complement: getString(payload, "complement"),
    fullName: getString(payload, "fullName"),
    gender: getString(payload, "gender"),
    neighborhood: getString(payload, "neighborhood"),
    number: getString(payload, "number"),
    phone: getString(payload, "phone"),
    state: normalizeState(getString(payload, "state")),
    street: getString(payload, "street"),
  } as EditableProfileInput;

  assertFieldMaxLengths(input, {
    birthDate: FIELD_LIMITS.birthDate,
    cep: FIELD_LIMITS.cep,
    city: FIELD_LIMITS.city,
    complement: FIELD_LIMITS.complement,
    fullName: FIELD_LIMITS.fullName,
    gender: FIELD_LIMITS.gender,
    neighborhood: FIELD_LIMITS.neighborhood,
    number: FIELD_LIMITS.number,
    phone: FIELD_LIMITS.phone,
    state: FIELD_LIMITS.state,
    street: FIELD_LIMITS.street,
  });

  if (input.fullName.length < 3 || !input.fullName.includes(" ")) {
    throw createHttpError(400, "Informe o nome completo.");
  }

  if (!/^\d{8}$/.test(normalizeCep(input.cep))) {
    throw createHttpError(400, "Informe um CEP válido com 8 números.");
  }

  if (
    !input.street ||
    !input.number ||
    !input.neighborhood ||
    !input.city ||
    !isBrazilianState(input.state)
  ) {
    throw createHttpError(400, "Informe o endereço completo.");
  }

  if (!validateBirthDate(input.birthDate)) {
    throw createHttpError(400, "Informe uma data de nascimento válida.");
  }

  if (!["masculino", "feminino", "nao-binario"].includes(input.gender)) {
    throw createHttpError(400, "Selecione uma opção de sexo válida.");
  }

  if (!validatePhone(input.phone)) {
    throw createHttpError(400, "Informe um celular válido no formato (21) 99999-9999.");
  }

  return input;
}

async function validateAddressPayload(
  payload: Record<string, unknown>,
  fallbackRecipientName: string,
): Promise<AddressInput> {
  const cep = validateCep(getString(payload, "cep"));
  const cepAddress = await fetchAddressByCep(cep);
  const input: AddressInput = {
    cep: cepAddress.cep,
    city: getString(payload, "city") || cepAddress.city,
    complement: getString(payload, "complement") || cepAddress.complement,
    isPrimary: payload.isPrimary === true,
    label: getString(payload, "label") || "Entrega",
    neighborhood: getString(payload, "neighborhood") || cepAddress.neighborhood,
    number: getString(payload, "number"),
    recipientName: getString(payload, "recipientName") || fallbackRecipientName,
    state: normalizeState(getString(payload, "state") || cepAddress.state),
    street: getString(payload, "street") || cepAddress.street,
  };

  assertFieldMaxLengths(input, {
    cep: FIELD_LIMITS.cep,
    city: FIELD_LIMITS.city,
    complement: FIELD_LIMITS.complement,
    label: FIELD_LIMITS.label,
    neighborhood: FIELD_LIMITS.neighborhood,
    number: FIELD_LIMITS.number,
    recipientName: FIELD_LIMITS.recipientName,
    state: FIELD_LIMITS.state,
    street: FIELD_LIMITS.street,
  });

  if (
    !input.recipientName ||
    !input.street ||
    !input.number ||
    !input.neighborhood ||
    !input.city ||
    !isBrazilianState(input.state)
  ) {
    throw createHttpError(400, "Informe o endereço completo.");
  }

  return input;
}

function isValidCheckoutItem(value: unknown): value is CheckoutItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as CheckoutItem;
  const isValidColor = item.colorId === "white" || item.colorId === "midnight";

  return (
    item.productId === "dualsense-edge" &&
    isValidColor &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= 10
  );
}

function normalizeCheckoutPaymentMethod(value: unknown): CheckoutPaymentMethod {
  const paymentMethod = String(value ?? "").trim().toLowerCase();

  if (paymentMethod === "credit_card" || paymentMethod === "cartoes_credito") {
    return "Cartões de crédito";
  }

  if (paymentMethod === "pix") {
    return "PIX";
  }

  throw createHttpError(400, "Selecione uma forma de pagamento válida.");
}

function ensureCompleteCepAddress(address: ApiAddress) {
  if (!address.city || !address.state) {
    throw createHttpError(502, "A consulta de CEP retornou dados incompletos.");
  }

  return address;
}

function mapViaCepAddress(payload: Record<string, unknown>): ApiAddress {
  return ensureCompleteCepAddress({
    cep: String(payload.cep ?? ""),
    city: String(payload.localidade ?? ""),
    complement: String(payload.complemento ?? ""),
    neighborhood: String(payload.bairro ?? ""),
    state: String(payload.uf ?? ""),
    street: String(payload.logradouro ?? ""),
  });
}

function mapBrasilApiAddress(payload: Record<string, unknown>): ApiAddress {
  return ensureCompleteCepAddress({
    cep: String(payload.cep ?? ""),
    city: String(payload.city ?? ""),
    complement: "",
    neighborhood: String(payload.neighborhood ?? ""),
    state: String(payload.state ?? ""),
    street: String(payload.street ?? ""),
  });
}

function mapOpenCepAddress(payload: Record<string, unknown>): ApiAddress {
  return ensureCompleteCepAddress({
    cep: String(payload.cep ?? ""),
    city: String(payload.localidade ?? ""),
    complement: String(payload.complemento ?? ""),
    neighborhood: String(payload.bairro ?? ""),
    state: String(payload.uf ?? ""),
    street: String(payload.logradouro ?? ""),
  });
}

function buildFallbackAddressByCep(cep: string): ApiAddress {
  const cepNumber = Number(cep);
  const region = CEP_FALLBACK_REGIONS.find(
    (item) => cepNumber >= item.min && cepNumber <= item.max,
  );

  if (!region) {
    throw createHttpError(404, "CEP não encontrado.");
  }

  return {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    city: region.city,
    complement: "",
    neighborhood: "Endereço validado em modo local",
    state: region.state,
    street: "Logradouro pendente de confirmação",
  };
}

function isHttpError(error: unknown): error is HttpError {
  return error instanceof Error && typeof (error as HttpError).statusCode === "number";
}

async function fetchCepFromProvider(provider: CepProvider, cep: string) {
  const controller = new AbortController();
  const timeout = windowlessSetTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(provider.url(cep), {
      headers: {
        Accept: "application/json",
        "User-Agent": "dualsense-edge-study/1.0",
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw createHttpError(404, "CEP não encontrado.");
    }

    if (!response.ok) {
      throw createHttpError(
        502,
        `Não foi possível consultar o serviço de CEP ${provider.name}.`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;

    if (provider.isNotFound?.(payload)) {
      throw createHttpError(404, "CEP não encontrado.");
    }

    return provider.mapAddress(payload);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAddressByCep(cep: string) {
  if (USE_LOCAL_CEP) {
    return buildFallbackAddressByCep(cep);
  }

  let foundNotFound = false;

  for (const provider of CEP_PROVIDERS) {
    try {
      return await fetchCepFromProvider(provider, cep);
    } catch (error) {
      if (isHttpError(error) && error.statusCode === 404) {
        foundNotFound = true;
      }
    }
  }

  if (foundNotFound) {
    throw createHttpError(404, "CEP não encontrado.");
  }

  return buildFallbackAddressByCep(cep);
}

function windowlessSetTimeout(callback: () => void, timeoutMs: number) {
  return setTimeout(callback, timeoutMs);
}

function buildShippingQuote(address: ApiAddress) {
  return {
    address,
    options: [
      {
        carrier: "Correios",
        estimate: "3 a 7 dias úteis",
        id: "standard-free",
        name: "Entrega padrão",
        priceCents: 0,
      },
      {
        carrier: "Correios",
        estimate: "1 a 3 dias úteis",
        id: "express-free",
        name: "Entrega expressa promocional",
        priceCents: 0,
      },
    ],
  };
}

async function handleShipping(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method !== "GET") {
    throw createHttpError(405, "Método não permitido.");
  }

  enforceRateLimit(request, "shipping", url.searchParams.get("cep") ?? "");
  const cep = validateCep(url.searchParams.get("cep"));
  const address = await fetchAddressByCep(cep);
  sendJson(request, response, 200, buildShippingQuote(address));
}

async function handleAuthMe(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "GET") {
    throw createHttpError(405, "Método não permitido.");
  }

  const user = findUserBySessionToken(getCookie(request, "ds_session"));
  sendJson(request, response, 200, { user });
}

async function handleProfile(request: IncomingMessage, response: ServerResponse) {
  const user = getAuthenticatedUser(request);

  if (request.method === "GET") {
    sendJson(request, response, 200, { user });
    return;
  }

  if (request.method === "PATCH") {
    const input = validateEditableProfilePayload(await readJsonBody(request));
    const address = await fetchAddressByCep(validateCep(input.cep));

    input.cep = address.cep;
    input.street = input.street || address.street;
    input.neighborhood = input.neighborhood || address.neighborhood;
    input.city = input.city || address.city;
    input.state = input.state || address.state;
    input.birthDate = user.birthDate;

    const updatedUser = updateUserProfile(user.id, input);

    if (!updatedUser) {
      throw createHttpError(404, "Cadastro não encontrado.");
    }

    sendJson(request, response, 200, { user: updatedUser });
    return;
  }

  if (request.method === "DELETE") {
    deleteUserAccount(user.id);
    clearSessionCookie(response);
    sendJson(request, response, 200, { ok: true });
    return;
  }

  throw createHttpError(405, "Método não permitido.");
}

async function handleRegister(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    throw createHttpError(405, "Método não permitido.");
  }

  const body = await readJsonBody(request);
  enforceRateLimit(
    request,
    "register",
    getString(body, "email") || getString(body, "cpf"),
  );
  const input = validateRegisterPayload(body);
  const address = await fetchAddressByCep(validateCep(input.cep));

  input.cep = address.cep;
  input.street = input.street || address.street;
  input.neighborhood = input.neighborhood || address.neighborhood;
  input.city = input.city || address.city;
  input.state = input.state || address.state;

  try {
    const user = createUser(input);
    const session = createSession(user.id);
    setSessionCookie(response, session.token, session.maxAgeSeconds);
    sendJson(request, response, 201, { user });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw createHttpError(409, "Já existe um cadastro com este e-mail ou CPF.");
    }

    throw error;
  }
}

async function handleLogin(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    throw createHttpError(405, "Método não permitido.");
  }

  const body = await readJsonBody(request);
  const email = normalizeEmail(getString(body, "email"));
  const password = getString(body, "password");
  enforceRateLimit(request, "login", email || "invalid-email");

  if (!validateEmail(email)) {
    throw createHttpError(400, "Digite um e-mail válido.");
  }

  if (!password) {
    throw createHttpError(400, "Informe e-mail e senha.");
  }

  if (password.length > FIELD_LIMITS.password) {
    throw createHttpError(400, "Informe uma senha válida.");
  }

  const loginResult = authenticateUserDetailed(email, password);

  if (loginResult.status === "not-found") {
    await delay(FAILED_AUTH_DELAY_MS);
    throw createHttpError(404, "Usuário não cadastrado.");
  }

  if (loginResult.status === "invalid-password") {
    await delay(FAILED_AUTH_DELAY_MS);
    throw createHttpError(
      401,
      "Senha incorreta. Caso tenha esquecido, redefina clicando em Esqueci minha senha.",
    );
  }

  const session = createSession(loginResult.user.id);
  setSessionCookie(response, session.token, session.maxAgeSeconds);
  sendJson(request, response, 200, { user: loginResult.user });
}

async function handleLogout(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    throw createHttpError(405, "Método não permitido.");
  }

  deleteSession(getCookie(request, "ds_session"));
  clearSessionCookie(response);
  sendJson(request, response, 200, { ok: true });
}

async function handleForgotPassword(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    throw createHttpError(405, "Método não permitido.");
  }

  const body = await readJsonBody(request);
  const email = normalizeEmail(getString(body, "email"));
  enforceRateLimit(request, "recovery", email || "invalid-email");

  if (!validateEmail(email)) {
    throw createHttpError(400, "Digite um e-mail válido.");
  }

  if (!findUserByEmail(email)) {
    throw createHttpError(404, "Usuário não cadastrado.");
  }

  sendJson(request, response, 200, {
    message: "Cadastro localizado. A redefinição de senha está em modo de simulação.",
  });
}

async function handleRecoverEmail(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    throw createHttpError(405, "Método não permitido.");
  }

  const body = await readJsonBody(request);
  const cpf = getString(body, "cpf");
  enforceRateLimit(request, "recovery", cpf || "invalid-cpf");

  if (!isValidCpf(cpf)) {
    throw createHttpError(400, "Informe um CPF válido no formato 000.000.000-00.");
  }

  const email = findEmailByCpf(cpf);

  if (!email) {
    throw createHttpError(404, "CPF não cadastrado.");
  }

  sendJson(request, response, 200, { email });
}

async function handleAddresses(request: IncomingMessage, response: ServerResponse) {
  const user = getAuthenticatedUser(request);

  if (request.method === "GET") {
    sendJson(request, response, 200, { addresses: listUserAddresses(user) });
    return;
  }

  if (request.method === "POST") {
    const input = await validateAddressPayload(await readJsonBody(request), user.fullName);
    const address = createUserAddress(user.id, input);

    sendJson(request, response, 201, { address });
    return;
  }

  throw createHttpError(405, "Método não permitido.");
}

async function handleAddressById(
  request: IncomingMessage,
  response: ServerResponse,
  addressId: string,
  isPrimaryRoute: boolean,
) {
  const user = getAuthenticatedUser(request);

  if (isPrimaryRoute) {
    if (request.method !== "POST") {
      throw createHttpError(405, "Método não permitido.");
    }

    const address = setUserPrimaryAddress(user.id, addressId);

    if (!address) {
      throw createHttpError(404, "Endereço não encontrado.");
    }

    sendJson(request, response, 200, { address });
    return;
  }

  if (request.method === "PATCH") {
    const input = await validateAddressPayload(await readJsonBody(request), user.fullName);
    const address = updateUserAddress(user.id, addressId, input);

    if (!address) {
      throw createHttpError(404, "Endereço não encontrado.");
    }

    sendJson(request, response, 200, { address });
    return;
  }

  if (request.method === "DELETE") {
    if (!deleteUserAddress(user.id, addressId)) {
      throw createHttpError(404, "Endereço não encontrado.");
    }

    sendJson(request, response, 200, { ok: true });
    return;
  }

  throw createHttpError(405, "Método não permitido.");
}

async function handleOrders(request: IncomingMessage, response: ServerResponse) {
  const user = getAuthenticatedUser(request);

  if (request.method !== "GET") {
    throw createHttpError(405, "Método não permitido.");
  }

  sendJson(request, response, 200, { orders: listUserOrders(user.id) });
}

async function handleCheckout(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") {
    throw createHttpError(405, "Método não permitido.");
  }

  const user = getAuthenticatedUser(request);
  enforceRateLimit(request, "checkout", user.id);
  const body = await readJsonBody(request);
  const cep = validateCep(String(body.cep ?? ""));
  const items = Array.isArray(body.items) ? body.items : [];
  const paymentMethod = normalizeCheckoutPaymentMethod(body.paymentMethod);

  if (items.length === 0 || !items.every(isValidCheckoutItem)) {
    throw createHttpError(400, "Carrinho inválido.");
  }

  const shippingOptionId = String(body.shippingOptionId ?? "");

  if (!["standard-free", "express-free"].includes(shippingOptionId)) {
    throw createHttpError(400, "Opção de frete inválida.");
  }

  const quote = buildShippingQuote(await fetchAddressByCep(cep));
  const selectedShippingOption = quote.options.find(
    (option) => option.id === shippingOptionId,
  );

  if (!selectedShippingOption) {
    throw createHttpError(400, "Opção de frete inválida.");
  }

  const userAddresses = listUserAddresses(user);
  const addressId = typeof body.addressId === "string" ? body.addressId : "";
  const deliveryAddress = addressId
    ? findUserAddress(user.id, addressId)
    : userAddresses.find((address) => address.isPrimary) ?? userAddresses[0];

  if (!deliveryAddress) {
    throw createHttpError(400, "Cadastre um endereço de entrega para finalizar.");
  }

  const orderItems = (items as CheckoutItem[]).map((item) => {
    const color = SHOP_COLORS[item.colorId];

    return {
      colorId: item.colorId,
      colorName: color.name,
      image: color.image,
      productId: SHOP_PRODUCT.id,
      productName: SHOP_PRODUCT.name,
      quantity: item.quantity,
      unitPriceCents: SHOP_PRODUCT.priceCents,
    };
  });
  const subtotalCents = orderItems.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
  const order = createUserOrder(user.id, {
    deliveryAddress,
    items: orderItems,
    paymentMethod,
    shippingCarrier: selectedShippingOption.carrier,
    shippingEstimate: selectedShippingOption.estimate,
    shippingPriceCents: selectedShippingOption.priceCents,
    totalCents: subtotalCents + selectedShippingOption.priceCents,
  });

  sendJson(request, response, 201, {
    message: "Compra simulada finalizada com sucesso.",
    order,
    orderId: order.orderCode,
    status: "approved",
  });
}

async function handleHealth(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "GET") {
    throw createHttpError(405, "Método não permitido.");
  }

  sendJson(request, response, 200, { ok: true });
}

function getMimeType(filePath: string) {
  const extension = extname(filePath);

  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";

  return "application/octet-stream";
}

async function serveStatic(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method !== "GET") {
    throw createHttpError(405, "Método não permitido.");
  }

  const rawPath = decodeURIComponent(url.pathname);
  const requestedPath = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = resolve(join(distDir, requestedPath));

  if (!filePath.startsWith(distDir)) {
    throw createHttpError(403, "Acesso negado.");
  }

  let finalPath = filePath;

  try {
    const fileStat = await stat(finalPath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }
  } catch {
    finalPath = join(distDir, "index.html");
  }

  const file = await readFile(finalPath);
  setSecurityHeaders(response);
  response.writeHead(200, {
    "Cache-Control": finalPath.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
    "Content-Type": getMimeType(finalPath),
  });
  response.end(file);
}

async function routeRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "OPTIONS") {
    setSecurityHeaders(response);
    setCorsHeaders(request, response);
    response.writeHead(204);
    response.end();
    return;
  }

  assertTrustedOrigin(request);

  if (url.pathname === "/api/health") {
    await handleHealth(request, response);
    return;
  }

  if (url.pathname === "/api/shipping") {
    await handleShipping(request, response, url);
    return;
  }

  if (url.pathname === "/api/auth/me") {
    await handleAuthMe(request, response);
    return;
  }

  if (url.pathname === "/api/auth/profile") {
    await handleProfile(request, response);
    return;
  }

  if (url.pathname === "/api/auth/register") {
    await handleRegister(request, response);
    return;
  }

  if (url.pathname === "/api/auth/login") {
    await handleLogin(request, response);
    return;
  }

  if (url.pathname === "/api/auth/logout") {
    await handleLogout(request, response);
    return;
  }

  if (url.pathname === "/api/auth/forgot-password") {
    await handleForgotPassword(request, response);
    return;
  }

  if (url.pathname === "/api/auth/recover-email") {
    await handleRecoverEmail(request, response);
    return;
  }

  if (url.pathname === "/api/auth/addresses") {
    await handleAddresses(request, response);
    return;
  }

  const addressRouteMatch = url.pathname.match(
    /^\/api\/auth\/addresses\/([^/]+)(?:\/(primary))?$/,
  );

  if (addressRouteMatch) {
    await handleAddressById(
      request,
      response,
      decodeURIComponent(addressRouteMatch[1]),
      addressRouteMatch[2] === "primary",
    );
    return;
  }

  if (url.pathname === "/api/auth/orders") {
    await handleOrders(request, response);
    return;
  }

  if (url.pathname === "/api/checkout") {
    await handleCheckout(request, response);
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    throw createHttpError(404, "Endpoint não encontrado.");
  }

  await serveStatic(request, response, url);
}

const server = createServer((request, response) => {
  routeRequest(request, response).catch((error: unknown) => {
    const httpError = error as HttpError;
    const statusCode = httpError.statusCode ?? 500;
    const message =
      statusCode === 500
        ? "Erro interno no servidor."
        : httpError.message;

    for (const [name, value] of Object.entries(httpError.headers ?? {})) {
      response.setHeader(name, value);
    }

    sendJson(request, response, statusCode, { message });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`API e storefront em http://127.0.0.1:${PORT}`);
});
