import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRedirect = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

import { getAdminUser, requireAdmin } from "./auth";

describe("lib/auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAdminUser mengembalikan null jika user belum login", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await getAdminUser();
    expect(result).toBeNull();
  });

  it("getAdminUser mengembalikan null jika user login tetapi tidak terdaftar di tabel admins", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "bukan-pemilik@example.com" } },
      error: null,
    });

    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    });

    const result = await getAdminUser();
    expect(result).toBeNull();
  });

  it("getAdminUser mengembalikan data admin jika user terdaftar di tabel admins", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "admin-456", email: "pemilik@rumahmakansipil.com" } },
      error: null,
    });

    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { user_id: "admin-456" }, error: null }),
        }),
      }),
    });

    const result = await getAdminUser();
    expect(result).toEqual({
      id: "admin-456",
      email: "pemilik@rumahmakansipil.com",
    });
  });

  it("requireAdmin me-redirect ke /admin/login jika bukan admin", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    await requireAdmin();
    expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
  });
});
