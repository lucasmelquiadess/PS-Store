import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

type Gender = "masculino" | "feminino" | "nao-binario";

export type PublicUser = {
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

export type EditableProfileInput = {
  fullName: string;
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
};

export type RegisterInput = EditableProfileInput & {
  email: string;
  cpf: string;
  password: string;
  confirmPassword: string;
};

export type AddressInput = {
  label: string;
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  isPrimary?: boolean;
};

export type AccountAddress = Omit<AddressInput, "isPrimary"> & {
  id: string;
  isPrimary: boolean;
};

export type OrderItemInput = {
  productId: string;
  productName: string;
  colorId: string;
  colorName: string;
  image: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderInput = {
  deliveryAddress: AccountAddress;
  items: OrderItemInput[];
  paymentMethod: string;
  shippingCarrier: string;
  shippingEstimate: string;
  shippingPriceCents: number;
  totalCents: number;
};

export type OrderStatus =
  | "realizado"
  | "pagamento_aprovado"
  | "nf_emitida"
  | "enviado"
  | "entregue";

export type AccountOrderItem = OrderItemInput & {
  id: string;
};

export type AccountOrder = Omit<OrderInput, "items"> & {
  createdAt: string;
  id: string;
  items: AccountOrderItem[];
  orderCode: string;
  status: OrderStatus;
};

type PublicUserRow = {
  id: string;
  full_name: string;
  email: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  birth_date: string;
  gender: Gender;
  phone: string;
};

type StoredUser = PublicUserRow & {
  password_hash: string;
  password_salt: string;
};

type AddressRow = {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  is_primary: number;
};

type OrderRow = {
  id: string;
  user_id: string;
  order_code: string;
  status: OrderStatus;
  total_cents: number;
  shipping_price_cents: number;
  shipping_estimate: string;
  shipping_carrier: string;
  payment_method: string;
  delivery_address_json: string;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  color_id: string;
  color_name: string;
  image: string;
  quantity: number;
  unit_price_cents: number;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = process.env.STORE_DB_PATH
  ? resolve(process.env.STORE_DB_PATH)
  : resolve(projectRoot, ".data", "storefront.sqlite");
const dataDir = dirname(databasePath);

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA secure_delete = ON;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    cpf TEXT NOT NULL UNIQUE,
    cep TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    complement TEXT NOT NULL DEFAULT '',
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('masculino', 'feminino', 'nao-binario')),
    phone TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    cep TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    complement TEXT NOT NULL DEFAULT '',
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pagamento_aprovado',
    total_cents INTEGER NOT NULL,
    shipping_price_cents INTEGER NOT NULL DEFAULT 0,
    shipping_estimate TEXT NOT NULL,
    shipping_carrier TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    delivery_address_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    color_id TEXT NOT NULL,
    color_name TEXT NOT NULL,
    image TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_sequence (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    next_value INTEGER NOT NULL CHECK (next_value > 0)
  );

  INSERT OR IGNORE INTO order_sequence (id, next_value) VALUES (1, 1);

  CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (!message.includes("duplicate column name")) {
    throw error;
  }
}

try {
  db.exec(
    "ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pagamento_aprovado';",
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (!message.includes("duplicate column name")) {
    throw error;
  }
}

const insertUserStatement = db.prepare(`
  INSERT INTO users (
    id,
    full_name,
    email,
    cpf,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    birth_date,
    gender,
    phone,
    password_hash,
    password_salt,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const findUserByEmailStatement = db.prepare(`
  SELECT
    id,
    full_name,
    email,
    cpf,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    birth_date,
    gender,
    phone,
    password_hash,
    password_salt
  FROM users
  WHERE email = ?
`);

const findUserByCpfStatement = db.prepare(`
  SELECT email
  FROM users
  WHERE cpf = ?
`);

const findPublicUserByIdStatement = db.prepare(`
  SELECT
    id,
    full_name,
    email,
    cpf,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    birth_date,
    gender,
    phone
  FROM users
  WHERE id = ?
`);

const findUserBySessionStatement = db.prepare(`
  SELECT
    users.id,
    users.full_name,
    users.email,
    users.cpf,
    users.cep,
    users.street,
    users.number,
    users.complement,
    users.neighborhood,
    users.city,
    users.state,
    users.birth_date,
    users.gender,
    users.phone
  FROM sessions
  INNER JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ?
    AND sessions.expires_at > ?
`);

const insertSessionStatement = db.prepare(`
  INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?)
`);

const deleteSessionStatement = db.prepare(`
  DELETE FROM sessions
  WHERE token_hash = ?
`);

const deleteExpiredSessionsStatement = db.prepare(`
  DELETE FROM sessions
  WHERE expires_at <= ?
`);

const updateUserProfileStatement = db.prepare(`
  UPDATE users
  SET
    full_name = ?,
    cep = ?,
    street = ?,
    number = ?,
    complement = ?,
    neighborhood = ?,
    city = ?,
    state = ?,
    birth_date = ?,
    gender = ?,
    phone = ?
  WHERE id = ?
`);

const deleteUserSessionsStatement = db.prepare(`
  DELETE FROM sessions
  WHERE user_id = ?
`);

const deleteUserAddressesStatement = db.prepare(`
  DELETE FROM addresses
  WHERE user_id = ?
`);

const anonymizeUserStatement = db.prepare(`
  UPDATE users
  SET
    full_name = ?,
    email = ?,
    cpf = ?,
    cep = ?,
    street = ?,
    number = ?,
    complement = ?,
    neighborhood = ?,
    city = ?,
    state = ?,
    birth_date = ?,
    gender = ?,
    phone = ?,
    password_hash = ?,
    password_salt = ?
  WHERE id = ?
`);

const countUserAddressesStatement = db.prepare(`
  SELECT COUNT(*) AS count
  FROM addresses
  WHERE user_id = ?
`);

const insertAddressStatement = db.prepare(`
  INSERT INTO addresses (
    id,
    user_id,
    label,
    recipient_name,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    is_primary,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const listAddressesStatement = db.prepare(`
  SELECT
    id,
    user_id,
    label,
    recipient_name,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    is_primary
  FROM addresses
  WHERE user_id = ?
  ORDER BY is_primary DESC, created_at ASC
`);

const findAddressStatement = db.prepare(`
  SELECT
    id,
    user_id,
    label,
    recipient_name,
    cep,
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    is_primary
  FROM addresses
  WHERE user_id = ? AND id = ?
`);

const updateAddressStatement = db.prepare(`
  UPDATE addresses
  SET
    label = ?,
    recipient_name = ?,
    cep = ?,
    street = ?,
    number = ?,
    complement = ?,
    neighborhood = ?,
    city = ?,
    state = ?
  WHERE user_id = ? AND id = ?
`);

const resetPrimaryAddressesStatement = db.prepare(`
  UPDATE addresses
  SET is_primary = 0
  WHERE user_id = ?
`);

const setPrimaryAddressStatement = db.prepare(`
  UPDATE addresses
  SET is_primary = 1
  WHERE user_id = ? AND id = ?
`);

const deleteAddressStatement = db.prepare(`
  DELETE FROM addresses
  WHERE user_id = ? AND id = ?
`);

const findFirstAddressStatement = db.prepare(`
  SELECT id
  FROM addresses
  WHERE user_id = ?
  ORDER BY created_at ASC
  LIMIT 1
`);

const insertOrderStatement = db.prepare(`
  INSERT INTO orders (
    id,
    user_id,
    order_code,
    status,
    total_cents,
    shipping_price_cents,
    shipping_estimate,
    shipping_carrier,
    payment_method,
    delivery_address_json,
    created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertOrderItemStatement = db.prepare(`
  INSERT INTO order_items (
    id,
    order_id,
    product_id,
    product_name,
    color_id,
    color_name,
    image,
    quantity,
    unit_price_cents
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const listOrdersStatement = db.prepare(`
  SELECT
    id,
    user_id,
    order_code,
    status,
    total_cents,
    shipping_price_cents,
    shipping_estimate,
    shipping_carrier,
    payment_method,
    delivery_address_json,
    created_at
  FROM orders
  WHERE user_id = ?
  ORDER BY created_at DESC
`);

const getOrderSequenceStatement = db.prepare(`
  SELECT next_value
  FROM order_sequence
  WHERE id = 1
`);

const updateOrderSequenceStatement = db.prepare(`
  UPDATE order_sequence
  SET next_value = ?
  WHERE id = 1
`);

const listOrderItemsStatement = db.prepare(`
  SELECT
    id,
    order_id,
    product_id,
    product_name,
    color_id,
    color_name,
    image,
    quantity,
    unit_price_cents
  FROM order_items
  WHERE order_id = ?
  ORDER BY rowid ASC
`);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "").slice(0, 8);
}

export function normalizeState(state: string) {
  return state.trim().toUpperCase().slice(0, 2);
}

export function isValidCpfFormat(cpf: string) {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf);
}

export function isValidCpf(cpf: string) {
  if (!isValidCpfFormat(cpf)) {
    return false;
  }

  const digits = cpf.replace(/\D/g, "");

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (factor: number) => {
    let total = 0;

    for (let index = 0; index < factor - 1; index += 1) {
      total += Number(digits[index]) * (factor - index);
    }

    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(10) === Number(digits[9]) &&
    calculateDigit(11) === Number(digits[10])
  );
}

export function getPasswordStrength(password: string) {
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z\d]/.test(password);
  const meetsMinimum =
    password.length >= 8 && hasUppercase && hasNumber && hasSpecial;

  if (password.length >= 12 && hasLowercase && meetsMinimum) {
    return "forte";
  }

  if (meetsMinimum) {
    return "moderada";
  }

  return "fraca";
}

export function validateBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function hashToken(token: string) {
  return scryptSync(token, "dualsense-edge-session", 32).toString("hex");
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64, {
    N: 16384,
    maxmem: 64 * 1024 * 1024,
    p: 1,
    r: 8,
  }).toString("hex");
}

function createPasswordRecord(password: string) {
  const salt = randomBytes(16).toString("hex");
  return {
    hash: hashPassword(password, salt),
    salt,
  };
}

function verifyPassword(password: string, user: StoredUser) {
  const receivedHash = Buffer.from(hashPassword(password, user.password_salt), "hex");
  const storedHash = Buffer.from(user.password_hash, "hex");

  return (
    receivedHash.length === storedHash.length &&
    timingSafeEqual(receivedHash, storedHash)
  );
}

function toPublicUser(user: PublicUserRow): PublicUser {
  return {
    birthDate: user.birth_date,
    cep: user.cep,
    city: user.city,
    complement: user.complement,
    cpf: user.cpf,
    email: user.email,
    fullName: user.full_name,
    gender: user.gender,
    id: user.id,
    neighborhood: user.neighborhood,
    number: user.number,
    phone: user.phone,
    state: user.state,
    street: user.street,
  };
}

function toAccountAddress(row: AddressRow): AccountAddress {
  return {
    cep: row.cep,
    city: row.city,
    complement: row.complement,
    id: row.id,
    isPrimary: row.is_primary === 1,
    label: row.label,
    neighborhood: row.neighborhood,
    number: row.number,
    recipientName: row.recipient_name,
    state: row.state,
    street: row.street,
  };
}

function normalizeAddressInput(input: AddressInput): Omit<AddressInput, "isPrimary"> {
  return {
    cep: normalizeCep(input.cep),
    city: input.city.trim(),
    complement: input.complement.trim(),
    label: input.label.trim() || "Principal",
    neighborhood: input.neighborhood.trim(),
    number: input.number.trim(),
    recipientName: input.recipientName.trim(),
    state: normalizeState(input.state),
    street: input.street.trim(),
  };
}

function toOrderItem(row: OrderItemRow): AccountOrderItem {
  return {
    colorId: row.color_id,
    colorName: row.color_name,
    id: row.id,
    image: row.image,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
  };
}

function parseOrderAddress(value: string): AccountAddress {
  try {
    return JSON.parse(value) as AccountAddress;
  } catch {
    return {
      cep: "",
      city: "",
      complement: "",
      id: "",
      isPrimary: false,
      label: "Entrega",
      neighborhood: "",
      number: "",
      recipientName: "",
      state: "",
      street: "",
    };
  }
}

function toAccountOrder(row: OrderRow): AccountOrder {
  return {
    createdAt: row.created_at,
    deliveryAddress: parseOrderAddress(row.delivery_address_json),
    id: row.id,
    items: (listOrderItemsStatement.all(row.id) as OrderItemRow[]).map(
      toOrderItem,
    ),
    orderCode: row.order_code,
    paymentMethod: row.payment_method,
    shippingCarrier: row.shipping_carrier,
    shippingEstimate: row.shipping_estimate,
    shippingPriceCents: row.shipping_price_cents,
    status: row.status,
    totalCents: row.total_cents,
  };
}

function createNextOrderCode() {
  const row = getOrderSequenceStatement.get() as
    | { next_value: number }
    | undefined;
  const nextValue = row?.next_value ?? 1;

  updateOrderSequenceStatement.run(nextValue + 1);

  return `PS-${String(nextValue).padStart(9, "0")}`;
}

export function createUser(input: RegisterInput) {
  const passwordRecord = createPasswordRecord(input.password);
  const id = randomBytes(16).toString("hex");
  const now = new Date().toISOString();

  insertUserStatement.run(
    id,
    input.fullName.trim(),
    normalizeEmail(input.email),
    input.cpf.trim(),
    normalizeCep(input.cep),
    input.street.trim(),
    input.number.trim(),
    input.complement.trim(),
    input.neighborhood.trim(),
    input.city.trim(),
    normalizeState(input.state),
    input.birthDate,
    input.gender,
    input.phone.trim(),
    passwordRecord.hash,
    passwordRecord.salt,
    now,
  );

  const publicUser = toPublicUser({
    birth_date: input.birthDate,
    cep: normalizeCep(input.cep),
    city: input.city.trim(),
    complement: input.complement.trim(),
    cpf: input.cpf.trim(),
    email: normalizeEmail(input.email),
    full_name: input.fullName.trim(),
    gender: input.gender,
    id,
    neighborhood: input.neighborhood.trim(),
    number: input.number.trim(),
    phone: input.phone.trim(),
    state: normalizeState(input.state),
    street: input.street.trim(),
  });

  createUserAddress(publicUser.id, {
    cep: publicUser.cep,
    city: publicUser.city,
    complement: publicUser.complement,
    isPrimary: true,
    label: "Principal",
    neighborhood: publicUser.neighborhood,
    number: publicUser.number,
    recipientName: publicUser.fullName,
    state: publicUser.state,
    street: publicUser.street,
  });

  return publicUser;
}

export function findUserByEmail(email: string) {
  return findUserByEmailStatement.get(normalizeEmail(email)) as StoredUser | undefined;
}

export function authenticateUser(email: string, password: string) {
  const user = findUserByEmail(email);

  if (!user || !verifyPassword(password, user)) {
    return null;
  }

  return toPublicUser(user);
}

export function authenticateUserDetailed(email: string, password: string) {
  const user = findUserByEmail(email);

  if (!user) {
    return { status: "not-found" } as const;
  }

  if (!verifyPassword(password, user)) {
    return { status: "invalid-password" } as const;
  }

  return {
    status: "authenticated",
    user: toPublicUser(user),
  } as const;
}

export function findEmailByCpf(cpf: string) {
  const row = findUserByCpfStatement.get(cpf.trim()) as
    | { email: string }
    | undefined;

  return row?.email ?? null;
}

export function findPublicUserById(userId: string) {
  const user = findPublicUserByIdStatement.get(userId) as
    | PublicUserRow
    | undefined;

  return user ? toPublicUser(user) : null;
}

export function updateUserProfile(userId: string, input: EditableProfileInput) {
  updateUserProfileStatement.run(
    input.fullName.trim(),
    normalizeCep(input.cep),
    input.street.trim(),
    input.number.trim(),
    input.complement.trim(),
    input.neighborhood.trim(),
    input.city.trim(),
    normalizeState(input.state),
    input.birthDate,
    input.gender,
    input.phone.trim(),
    userId,
  );

  return findPublicUserById(userId);
}

export function deleteUserAccount(userId: string) {
  const deletedAt = Date.now();
  const password = createPasswordRecord(randomBytes(32).toString("base64url"));

  try {
    db.exec("BEGIN IMMEDIATE;");
    deleteUserSessionsStatement.run(userId);
    deleteUserAddressesStatement.run(userId);
    anonymizeUserStatement.run(
      "Cadastro excluído",
      `deleted-${userId}-${deletedAt}@deleted.local`,
      `deleted-${userId}-${deletedAt}`,
      "00000-000",
      "Cadastro excluído",
      "0",
      "",
      "Cadastro excluído",
      "Cadastro excluído",
      "NA",
      "1900-01-01",
      "nao-binario",
      "",
      password.hash,
      password.salt,
      userId,
    );
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export function ensureUserPrimaryAddress(user: PublicUser) {
  const row = countUserAddressesStatement.get(user.id) as
    | { count: number }
    | undefined;

  if ((row?.count ?? 0) > 0) {
    return;
  }

  createUserAddress(user.id, {
    cep: user.cep,
    city: user.city,
    complement: user.complement,
    isPrimary: true,
    label: "Principal",
    neighborhood: user.neighborhood,
    number: user.number,
    recipientName: user.fullName,
    state: user.state,
    street: user.street,
  });
}

export function listUserAddresses(user: PublicUser) {
  ensureUserPrimaryAddress(user);

  return (listAddressesStatement.all(user.id) as AddressRow[]).map(
    toAccountAddress,
  );
}

export function findUserAddress(userId: string, addressId: string) {
  const row = findAddressStatement.get(userId, addressId) as
    | AddressRow
    | undefined;

  return row ? toAccountAddress(row) : null;
}

export function createUserAddress(userId: string, input: AddressInput) {
  const id = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const address = normalizeAddressInput(input);
  const countRow = countUserAddressesStatement.get(userId) as
    | { count: number }
    | undefined;
  const shouldBePrimary = Boolean(input.isPrimary) || (countRow?.count ?? 0) === 0;

  if (shouldBePrimary) {
    resetPrimaryAddressesStatement.run(userId);
  }

  insertAddressStatement.run(
    id,
    userId,
    address.label,
    address.recipientName,
    address.cep,
    address.street,
    address.number,
    address.complement,
    address.neighborhood,
    address.city,
    address.state,
    shouldBePrimary ? 1 : 0,
    now,
  );

  return findUserAddress(userId, id);
}

export function updateUserAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
) {
  const address = normalizeAddressInput(input);

  updateAddressStatement.run(
    address.label,
    address.recipientName,
    address.cep,
    address.street,
    address.number,
    address.complement,
    address.neighborhood,
    address.city,
    address.state,
    userId,
    addressId,
  );

  if (input.isPrimary) {
    setUserPrimaryAddress(userId, addressId);
  }

  return findUserAddress(userId, addressId);
}

export function setUserPrimaryAddress(userId: string, addressId: string) {
  const address = findUserAddress(userId, addressId);

  if (!address) {
    return null;
  }

  resetPrimaryAddressesStatement.run(userId);
  setPrimaryAddressStatement.run(userId, addressId);

  return findUserAddress(userId, addressId);
}

export function deleteUserAddress(userId: string, addressId: string) {
  const address = findUserAddress(userId, addressId);

  if (!address) {
    return false;
  }

  deleteAddressStatement.run(userId, addressId);

  if (address.isPrimary) {
    const nextAddress = findFirstAddressStatement.get(userId) as
      | { id: string }
      | undefined;

    if (nextAddress) {
      setPrimaryAddressStatement.run(userId, nextAddress.id);
    }
  }

  return true;
}

export function createUserOrder(userId: string, input: OrderInput) {
  const id = randomBytes(16).toString("hex");
  const createdAt = new Date().toISOString();
  let orderCode = "";
  const status: OrderStatus = "pagamento_aprovado";

  try {
    db.exec("BEGIN IMMEDIATE;");
    orderCode = createNextOrderCode();
    insertOrderStatement.run(
      id,
      userId,
      orderCode,
      status,
      input.totalCents,
      input.shippingPriceCents,
      input.shippingEstimate,
      input.shippingCarrier,
      input.paymentMethod,
      JSON.stringify(input.deliveryAddress),
      createdAt,
    );

    input.items.forEach((item) => {
      insertOrderItemStatement.run(
        randomBytes(16).toString("hex"),
        id,
        item.productId,
        item.productName,
        item.colorId,
        item.colorName,
        item.image,
        item.quantity,
        item.unitPriceCents,
      );
    });

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  return toAccountOrder({
    created_at: createdAt,
    delivery_address_json: JSON.stringify(input.deliveryAddress),
    id,
    order_code: orderCode,
    payment_method: input.paymentMethod,
    shipping_carrier: input.shippingCarrier,
    shipping_estimate: input.shippingEstimate,
    shipping_price_cents: input.shippingPriceCents,
    status,
    total_cents: input.totalCents,
    user_id: userId,
  });
}

export function listUserOrders(userId: string) {
  return (listOrdersStatement.all(userId) as OrderRow[]).map(toAccountOrder);
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  deleteExpiredSessionsStatement.run(now.toISOString());
  insertSessionStatement.run(
    randomBytes(16).toString("hex"),
    userId,
    tokenHash,
    now.toISOString(),
    expiresAt.toISOString(),
  );

  return {
    maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000),
    token,
  };
}

export function findUserBySessionToken(token: string | null) {
  if (!token) {
    return null;
  }

  deleteExpiredSessionsStatement.run(new Date().toISOString());
  const user = findUserBySessionStatement.get(
    hashToken(token),
    new Date().toISOString(),
  ) as PublicUserRow | undefined;

  return user ? toPublicUser(user) : null;
}

export function deleteSession(token: string | null) {
  if (!token) {
    return;
  }

  deleteSessionStatement.run(hashToken(token));
}
