import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

describe("GET /api/admin/cashbook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan 401 jika bukan admin", async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null);

    const request = new Request("http://localhost/api/admin/cashbook");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("mengembalikan 400 jika query tidak valid", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

    const request = new Request("http://localhost/api/admin/cashbook?preset=custom&from=2026-10-20&to=2026-10-10");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("BAD_REQUEST");
  });

  it("mengembalikan 200 dan data buku kas jika query valid", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        period: { from: "2026-10-23", to: "2026-10-23" },
        summary: { totalIncome: 100000, totalExpense: 20000, grossProfit: 80000 },
        dailyBreakdown: [],
      },
      error: null,
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const request = new Request("http://localhost/api/admin/cashbook?preset=today");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary.grossProfit).toBe(80000);
  });

  it("mengembalikan 500 jika RPC cashbook mengalami galat", async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@warung.local" });

    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database connection failed" },
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      rpc: mockRpc,
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const request = new Request("http://localhost/api/admin/cashbook?preset=today");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("INTERNAL_SERVER_ERROR");
  });
});
