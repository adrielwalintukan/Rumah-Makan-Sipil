import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock Supabase service client
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
  }),
}));

// Mock IP helper
vi.mock("@/lib/ip", () => ({
  getClientIpHash: () => "mock-ip-hash-123",
}));

import { POST as createOrderHandler } from "./route";
import { GET as getOrderHandler } from "./[token]/route";
import { POST as claimPaidHandler } from "./[token]/claim-paid/route";

describe("Route Handlers: /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    customer_name: "Budi Santoso",
    order_type: "dine_in",
    payment_method: "qris",
    idempotency_key: "idem-123",
    device_id: "dev-123",
    items: [
      {
        menu_item_id: "00000000-0000-0000-0000-000000000001",
        quantity: 1,
      },
    ],
  };

  it("POST /api/orders mengembalikan 400 jika body bukan JSON valid", async () => {
    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      body: "bukan-json",
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("JSON yang valid");
  });

  it("POST /api/orders mengembalikan 400 jika validasi payload gagal", async () => {
    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validPayload, customer_name: "A" }),
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Validasi data pesanan gagal");
  });

  it("POST /api/orders mengembalikan 400 jika toko tutup (STORE_CLOSED)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: '{"code": "STORE_CLOSED"}' },
    });

    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Toko sedang tutup");
  });

  it("POST /api/orders mengembalikan 429 jika terkena rate limit (RATE_LIMITED)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: '{"code": "RATE_LIMITED"}' },
    });

    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain("Terlalu banyak pesanan");
  });

  it("POST /api/orders mengembalikan 400 jika menu/opsi habis (ITEM_UNAVAILABLE)", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: JSON.stringify({
          code: "ITEM_UNAVAILABLE",
          item_ids: ["00000000-0000-0000-0000-000000000001"],
        }),
      },
    });

    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sedang habis");
    expect(data.unavailable_item_ids).toEqual(["00000000-0000-0000-0000-000000000001"]);
  });

  it("POST /api/orders mengembalikan 201 dan detail pesanan jika berhasil", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { public_token: "token12345678901234567890", daily_number: 1, total: 15000 },
      error: null,
    });

    const req = new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    const res = await createOrderHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.daily_number).toBe(1);
    expect(data.total).toBe(15000);
  });

  it("GET /api/orders/[token] mengembalikan 404 jika token tidak ditemukan", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const req = new Request("http://localhost/api/orders/token-unknown");
    const res = await getOrderHandler(req, { params: Promise.resolve({ token: "token-unknown" }) });
    expect(res.status).toBe(404);
  });

  it("GET /api/orders/[token] mengembalikan 200 dan data pesanan segar tanpa cache", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        public_token: "tok123",
        daily_number: 1,
        customer_name: "Budi",
        items: [],
      },
      error: null,
    });

    const req = new Request("http://localhost/api/orders/tok123");
    const res = await getOrderHandler(req, { params: Promise.resolve({ token: "tok123" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const data = await res.json();
    expect(data.customer_name).toBe("Budi");
  });

  it("POST /api/orders/[token]/claim-paid mengembalikan 200 dan status terbaru", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, payment_status: "menunggu_verifikasi" },
      error: null,
    });

    const req = new Request("http://localhost/api/orders/tok123/claim-paid", { method: "POST" });
    const res = await claimPaidHandler(req, { params: Promise.resolve({ token: "tok123" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payment_status).toBe("menunggu_verifikasi");
  });

  it("POST /api/orders/[token]/claim-paid mengembalikan 404 jika token tidak ada", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const req = new Request("http://localhost/api/orders/unknown/claim-paid", { method: "POST" });
    const res = await claimPaidHandler(req, { params: Promise.resolve({ token: "unknown" }) });
    expect(res.status).toBe(404);
  });
});
