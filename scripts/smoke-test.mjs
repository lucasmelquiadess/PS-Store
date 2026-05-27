import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = resolve(rootDir, ".data");
const dbPath = resolve(dataDir, `smoke-test-${process.pid}.sqlite`);
const port = 3417;
const baseUrl = `http://127.0.0.1:${port}`;

mkdirSync(dataDir, { recursive: true });

function removeDatabaseFiles() {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

function startServer() {
  const server = spawn(process.execPath, [resolve(rootDir, ".server-dist/index.js")], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      STORE_CEP_MODE: "local",
      STORE_DB_PATH: dbPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { output: () => output, server };
}

async function stopServer(server) {
  if (server.exitCode !== null || server.killed) {
    return;
  }

  await new Promise((resolveStop) => {
    server.once("exit", resolveStop);
    server.kill();
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 200));
    }
  }

  throw new Error("API did not become ready in time.");
}

async function request(path, options = {}, cookie = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }

  return { payload, response };
}

function getSessionCookie(response) {
  const setCookie = response.headers.get("set-cookie");

  if (!setCookie) {
    throw new Error("Session cookie was not returned.");
  }

  return setCookie.split(";")[0];
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readDatabaseSummary() {
  const db = new DatabaseSync(dbPath);

  try {
    const orders = db.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
    const users = db.prepare("SELECT full_name AS fullName FROM users").all();
    const sessions = db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count;
    const nextOrder = db
      .prepare("SELECT next_value AS nextValue FROM order_sequence WHERE id = 1")
      .get().nextValue;

    return { nextOrder, orders, sessions, users };
  } finally {
    db.close();
  }
}

async function run() {
  removeDatabaseFiles();
  const { output, server } = startServer();

  try {
    await waitForHealth();

    const shipping = await request("/api/shipping?cep=26550130");
    assert(shipping.payload.options[0].priceCents === 0, "Shipping should be free.");

    const registerResponse = await request("/api/auth/register", {
      body: JSON.stringify({
        acceptedTerms: true,
        birthDate: "1995-12-18",
        cep: "26550-130",
        city: "Mesquita",
        complement: "101",
        confirmPassword: "Senha@123",
        cpf: "529.982.247-25",
        email: "smoke.test@example.com",
        fullName: "Cliente Smoke Test",
        gender: "masculino",
        neighborhood: "Juscelino",
        number: "227",
        password: "Senha@123",
        phone: "(21) 99999-9999",
        state: "RJ",
        street: "Rua Zoé",
      }),
      method: "POST",
    });
    const cookie = getSessionCookie(registerResponse.response);
    assert(registerResponse.payload.user.email === "smoke.test@example.com", "User email mismatch.");

    const profile = await request(
      "/api/auth/profile",
      {
        body: JSON.stringify({
          birthDate: "2000-01-01",
          cep: "26550-130",
          city: "Mesquita",
          complement: "101",
          fullName: "Cliente Smoke Test",
          gender: "masculino",
          neighborhood: "Juscelino",
          number: "227",
          phone: "(21) 99999-9999",
          state: "RJ",
          street: "Rua Zoé",
        }),
        method: "PATCH",
      },
      cookie,
    );
    assert(profile.payload.user.birthDate === "1995-12-18", "Birth date should remain protected.");

    const addresses = await request("/api/auth/addresses", {}, cookie);
    assert(addresses.payload.addresses.length === 1, "Primary address should be created.");
    assert(addresses.payload.addresses[0].isPrimary === true, "Primary address should be favorite.");

    const checkout = await request(
      "/api/checkout",
      {
        body: JSON.stringify({
          cep: "26550130",
          items: [{ colorId: "white", productId: "dualsense-edge", quantity: 1 }],
          paymentMethod: "PIX",
          shippingOptionId: "standard-free",
        }),
        method: "POST",
      },
      cookie,
    );
    assert(checkout.payload.orderId === "PS-000000001", "Order sequence should start at PS-000000001.");
    assert(checkout.payload.order.status === "pagamento_aprovado", "Order should stop at payment approved.");

    const orders = await request("/api/auth/orders", {}, cookie);
    assert(orders.payload.orders.length === 1, "Order history should return created order.");

    await request("/api/auth/profile", { method: "DELETE" }, cookie);
    const summary = readDatabaseSummary();
    assert(summary.orders === 1, "Completed orders must remain after account deletion.");
    assert(summary.sessions === 0, "Sessions should be removed after account deletion.");
    assert(summary.users[0]?.fullName === "Cadastro excluído", "Deleted account should be anonymized.");
    assert(summary.nextOrder === 2, "Order sequence should advance after checkout.");

    console.log("Smoke test passed: API, auth, SQLite, checkout and deletion flow are working.");
  } catch (error) {
    console.error(output());
    throw error;
  } finally {
    await stopServer(server);
    removeDatabaseFiles();
  }
}

await run();
