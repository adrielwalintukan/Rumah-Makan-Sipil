# Rencana Implementasi: Riwayat Pesanan dengan Filter Tanggal & Detail (Issue #20)

> **Untuk agentic workers:** REQUIRED SUB-SKILL: Gunakan `superpowers:subagent-driven-development` untuk mengeksekusi rencana ini task-per-task. Setiap task ditugaskan ke subagent implementer baru dan diverifikasi oleh subagent reviewer sebelum beralih ke task berikutnya.

**Goal:** Membangun antarmuka dan API riwayat pesanan (`/admin/riwayat`) dengan filter preset tanggal berbasis WITA (`Asia/Makassar`), rentang tanggal kustom, filter status, pencarian cepat, ringkasan metrik omzet, daftar pesanan responsif, paginasi 50 item, dan drawer/modal detail pesanan lengkap beserta aksi koreksi "Tandai Lunas".

**Architecture:** Halaman `app/admin/(dashboard)/riwayat/page.tsx` diimplementasikan sebagai Server Component yang membaca `searchParams` URL dan mengambil data pesanan serta ringkasan melalui helper `getOrderHistory` di `lib/admin-orders.ts`. Disediakan endpoint `GET /api/admin/orders/history` berotentikasi pemilik dengan validasi skema Zod `orderHistoryQuerySchema`. Detail pesanan disajikan responsif (Bottom Sheet di layar HP < 768px dan Dialog Modal di layar desktop).

**Tech Stack:** Next.js (App Router, Server Components), TypeScript strict, Tailwind CSS, shadcn/ui (Radix UI Sheet & Dialog, Lucide icons), Supabase PostgreSQL, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-m5-order-history-design.md`

## Global Constraints

- Sesuai panduan Antislop: Dials `ENERGY 1 / RHYTHM 2 / MOTION 1`.
- Dilarang menggunakan karakter em dash (`—`) dalam teks UI atau pesan error; gunakan strip biasa `-`, koma, atau titik dua `:` (aturan antislop R-02).
- Target sentuh elemen interaktif wajib >= 44px (`min-h-[44px] min-w-[44px]`).
- Kontras warna teks memenuhi standar WCAG AA (teks gelap `text-ink-900`, `text-ink-700`, `text-ink-600` di atas latar terang).
- Desain mobile-first: tata letak wajib rapi pada viewport 360px tanpa overflow horizontal.
- Semua tanggal dan pengelompokan hari wajib berbasis zona waktu WITA (`Asia/Makassar`).
- Semua harga/nominal berupa integer Rupiah bulat (format melalui `formatRupiah`).
- Komit git mengikuti Conventional Commits dalam Bahasa Indonesia tanpa footer AI (`AGENTS.md §13`).
- Dilarang menambah dependency library eksternal baru (prinsip *ponytail*).

---

### Task 1: Skema Validasi Query Zod & Helper Tanggal WITA

**Files:**
- Modify: `lib/admin-orders.ts`
- Test: `lib/admin-orders.test.ts`

**Interfaces:**
- Produces:
  - `getWitaTodayDateString(): string`
  - `getWitaDateRange(preset: "today" | "yesterday" | "last7days" | "last30days", now?: Date): { from: string; to: string }`
  - `orderHistoryQuerySchema: z.ZodObject<...>`
  - `OrderHistoryQuery: z.infer<typeof orderHistoryQuerySchema>`

- [ ] **Step 1: Tulis tes gagal (RED) di `lib/admin-orders.test.ts`**

Tambahkan pengujian unit untuk fungsi tanggal WITA dan skema validasi Zod:

```typescript
describe("WITA Date Helpers & orderHistoryQuerySchema", () => {
  it("menghasilkan tanggal hari ini dalam format YYYY-MM-DD zona waktu WITA", () => {
    const today = getWitaTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("menghitung rentang tanggal yang tepat untuk preset today, yesterday, last7days, dan last30days", () => {
    // 2026-10-21 04:00:00 UTC = 2026-10-21 12:00:00 WITA (UTC+8)
    const fixedDate = new Date("2026-10-21T04:00:00Z");

    const todayRange = getWitaDateRange("today", fixedDate);
    expect(todayRange).toEqual({ from: "2026-10-21", to: "2026-10-21" });

    const yesterdayRange = getWitaDateRange("yesterday", fixedDate);
    expect(yesterdayRange).toEqual({ from: "2026-10-20", to: "2026-10-20" });

    const last7daysRange = getWitaDateRange("last7days", fixedDate);
    expect(last7daysRange).toEqual({ from: "2026-10-15", to: "2026-10-21" });

    const last30daysRange = getWitaDateRange("last30days", fixedDate);
    expect(last30daysRange).toEqual({ from: "2026-09-22", to: "2026-10-21" });
  });

  it("memvalidasi query params riwayat pesanan dengan nilai default yang benar", () => {
    const parsed = orderHistoryQuerySchema.parse({});
    expect(parsed.preset).toBe("today");
    expect(parsed.status).toBe("all");
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
  });

  it("menerima preset kustom dengan rentang tanggal from dan to yang valid", () => {
    const parsed = orderHistoryQuerySchema.parse({
      preset: "custom",
      from: "2026-10-01",
      to: "2026-10-15",
      status: "selesai",
      search: "budi",
      page: "2",
      limit: "25",
    });
    expect(parsed.preset).toBe("custom");
    expect(parsed.from).toBe("2026-10-01");
    expect(parsed.to).toBe("2026-10-15");
    expect(parsed.status).toBe("selesai");
    expect(parsed.search).toBe("budi");
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(25);
  });

  it("menolak tanggal kustom yang tidak sesuai format YYYY-MM-DD", () => {
    expect(() =>
      orderHistoryQuerySchema.parse({
        preset: "custom",
        from: "01-10-2026",
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memverifikasi kegagalan (RED)**

```bash
npx vitest run lib/admin-orders.test.ts
```
Ekspektasi: Gagal karena `getWitaTodayDateString`, `getWitaDateRange`, dan `orderHistoryQuerySchema` belum didefinisikan.

- [ ] **Step 3: Implementasikan helper tanggal WITA & skema Zod di `lib/admin-orders.ts` (GREEN)**

Tambahkan kode implementasi pada `lib/admin-orders.ts`:

```typescript
export function getWitaTodayDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function getWitaDateRange(
  preset: "today" | "yesterday" | "last7days" | "last30days",
  now: Date = new Date()
): { from: string; to: string } {
  const todayStr = getWitaTodayDateString(now);
  const [year, month, day] = todayStr.split("-").map(Number);
  // Buat objek tanggal tengah hari dalam zona lokal untuk perhitungan offset aman
  const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const formatOffset = (offsetDays: number): string => {
    const d = new Date(baseDate);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dt = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dt}`;
  };

  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "yesterday": {
      const yesterdayStr = formatOffset(-1);
      return { from: yesterdayStr, to: yesterdayStr };
    }
    case "last7days":
      return { from: formatOffset(-6), to: todayStr };
    case "last30days":
      return { from: formatOffset(-29), to: todayStr };
  }
}

export const orderHistoryPresetEnum = z.enum([
  "today",
  "yesterday",
  "last7days",
  "last30days",
  "custom",
]);
export type OrderHistoryPreset = z.infer<typeof orderHistoryPresetEnum>;

export const orderHistoryStatusFilterEnum = z.enum(["all", "selesai", "batal"]);
export type OrderHistoryStatusFilter = z.infer<typeof orderHistoryStatusFilterEnum>;

export const orderHistoryQuerySchema = z.object({
  preset: orderHistoryPresetEnum.default("today"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal awal harus YYYY-MM-DD.")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal akhir harus YYYY-MM-DD.")
    .optional(),
  status: orderHistoryStatusFilterEnum.default("all"),
  search: z
    .string()
    .trim()
    .max(50, "Kata kunci pencarian maksimal 50 karakter.")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type OrderHistoryQuery = z.infer<typeof orderHistoryQuerySchema>;
```

- [ ] **Step 4: Jalankan tes unit dan pastikan lulus (GREEN)**

```bash
npx vitest run lib/admin-orders.test.ts
```
Ekspektasi: Seluruh pengujian di `lib/admin-orders.test.ts` berhasil (PASS).

- [ ] **Step 5: Komit perubahan**

```bash
git add lib/admin-orders.ts lib/admin-orders.test.ts
git commit -m "feat(orders): tambah utilitas tanggal WITA dan skema query riwayat pesanan"
```

---

### Task 2: Query Helper `getOrderHistory` di `lib/admin-orders.ts` & Unit Tests

**Files:**
- Modify: `lib/admin-orders.ts`
- Test: `lib/admin-orders.test.ts`

**Interfaces:**
- Consumes:
  - `OrderHistoryQuery`, `getWitaTodayDateString`, `getWitaDateRange` dari Task 1.
- Produces:
  - `OrderHistorySummary`: `{ totalOrders: number; totalRevenue: number; totalCash: number; totalQris: number }`
  - `OrderHistoryResult`: `{ orders: AdminOrder[]; totalCount: number; summary: OrderHistorySummary; page: number; totalPages: number }`
  - `getOrderHistory(supabase: SupabaseClient, query: OrderHistoryQuery): Promise<OrderHistoryResult>`

- [ ] **Step 1: Tulis tes gagal (RED) di `lib/admin-orders.test.ts`**

Tambahkan pengujian unit untuk `getOrderHistory` dengan mock Supabase client:

```typescript
describe("getOrderHistory", () => {
  it("mengambil data pesanan dan menghitung ringkasan omzet lunas dengan tepat", async () => {
    const mockOrdersData = [
      {
        id: "order-1",
        public_token: "token-abc-1234567890123",
        order_date: "2026-10-21",
        daily_number: 1,
        customer_name: "Budi Santoso",
        customer_phone: "08123456789",
        order_type: "dine_in",
        payment_method: "cash",
        payment_status: "lunas",
        status: "selesai",
        total: 50000,
        cancel_reason: null,
        created_at: "2026-10-21T02:00:00Z",
        paid_at: "2026-10-21T02:05:00Z",
        order_items: [],
      },
      {
        id: "order-2",
        public_token: "token-def-1234567890123",
        order_date: "2026-10-21",
        daily_number: 2,
        customer_name: "Siti Rahma",
        customer_phone: null,
        order_type: "takeaway",
        payment_method: "qris",
        payment_status: "lunas",
        status: "selesai",
        total: 35000,
        cancel_reason: null,
        created_at: "2026-10-21T03:00:00Z",
        paid_at: "2026-10-21T03:02:00Z",
        order_items: [],
      },
      {
        id: "order-3",
        public_token: "token-ghi-1234567890123",
        order_date: "2026-10-21",
        daily_number: 3,
        customer_name: "Andi",
        customer_phone: null,
        order_type: "dine_in",
        payment_method: "cash",
        payment_status: "belum_bayar",
        status: "batal",
        total: 20000,
        cancel_reason: "Pelanggan batal",
        created_at: "2026-10-21T04:00:00Z",
        paid_at: null,
        order_items: [],
      },
    ];

    const mockSummaryRows = [
      { payment_method: "cash", payment_status: "lunas", status: "selesai", total: 50000 },
      { payment_method: "qris", payment_status: "lunas", status: "selesai", total: 35000 },
      { payment_method: "cash", payment_status: "belum_bayar", status: "batal", total: 20000 },
    ];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "orders") {
          return {
            select: vi.fn((fields: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact" && fields === "id") {
                // Mock total count query
                return {
                  gte: vi.fn().mockReturnThis(),
                  lte: vi.fn().mockReturnThis(),
                  eq: vi.fn().mockReturnThis(),
                  in: vi.fn().mockReturnThis(),
                  or: vi.fn().mockReturnThis(),
                  then: (resolve: any) => resolve({ count: 3, error: null }),
                };
              }
              if (fields.includes("payment_method, payment_status, status, total")) {
                // Mock summary query
                return {
                  gte: vi.fn().mockReturnThis(),
                  lte: vi.fn().mockReturnThis(),
                  eq: vi.fn().mockReturnThis(),
                  in: vi.fn().mockReturnThis(),
                  or: vi.fn().mockReturnThis(),
                  then: (resolve: any) => resolve({ data: mockSummaryRows, error: null }),
                };
              }
              // Mock paginated orders query
              return {
                gte: vi.fn().mockReturnThis(),
                lte: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                or: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                range: vi.fn().mockReturnThis(),
                then: (resolve: any) => resolve({ data: mockOrdersData, error: null }),
              };
            }),
          };
        }
        return {} as any;
      }),
    } as unknown as SupabaseClient;

    const res = await getOrderHistory(mockSupabase, {
      preset: "today",
      status: "all",
      page: 1,
      limit: 50,
    });

    expect(res.orders).toHaveLength(3);
    expect(res.totalCount).toBe(3);
    expect(res.totalPages).toBe(1);
    expect(res.summary.totalOrders).toBe(3);
    // Omzet hanya dari pesanan berstatus lunas dan tidak batal (50.000 + 35.000 = 85.000)
    expect(res.summary.totalRevenue).toBe(85000);
    expect(res.summary.totalCash).toBe(50000);
    expect(res.summary.totalQris).toBe(35000);
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memverifikasi kegagalan (RED)**

```bash
npx vitest run lib/admin-orders.test.ts
```

- [ ] **Step 3: Implementasikan fungsi `getOrderHistory` di `lib/admin-orders.ts` (GREEN)**

Tambahkan antarmuka hasil dan fungsi query ke `lib/admin-orders.ts`:

```typescript
export interface OrderHistorySummary {
  totalOrders: number;
  totalRevenue: number;
  totalCash: number;
  totalQris: number;
}

export interface OrderHistoryResult {
  orders: AdminOrder[];
  totalCount: number;
  summary: OrderHistorySummary;
  page: number;
  totalPages: number;
}

export async function getOrderHistory(
  supabase: SupabaseClient,
  query: OrderHistoryQuery
): Promise<OrderHistoryResult> {
  const { preset, status, search, page, limit } = query;

  let fromDate: string;
  let toDate: string;

  if (preset === "custom" && query.from && query.to) {
    fromDate = query.from;
    toDate = query.to;
  } else if (preset === "custom" && query.from) {
    fromDate = query.from;
    toDate = query.from;
  } else if (preset === "custom" && query.to) {
    fromDate = query.to;
    toDate = query.to;
  } else {
    const range = getWitaDateRange(preset === "custom" ? "today" : preset);
    fromDate = range.from;
    toDate = range.to;
  }

  // Helper untuk menerapkan filter tanggal, status, dan pencarian pada builder query
  const applyFilters = (builder: any) => {
    builder = builder.gte("order_date", fromDate).lte("order_date", toDate);

    if (status === "selesai") {
      builder = builder.eq("status", "selesai");
    } else if (status === "batal") {
      builder = builder.eq("status", "batal");
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      const dailyNum = parseInt(q.replace(/^#/, ""), 10);
      if (!isNaN(dailyNum) && dailyNum > 0) {
        builder = builder.or(`customer_name.ilike.%${q}%,daily_number.eq.${dailyNum}`);
      } else {
        builder = builder.ilike("customer_name", `%${q}%`);
      }
    }

    return builder;
  };

  // 1. Ambil data agregasi ringkasan (seluruh dataset yang cocok dengan filter)
  const summaryQuery = applyFilters(
    supabase
      .from("orders")
      .select("payment_method, payment_status, status, total")
  );
  const { data: summaryRows } = await summaryQuery;

  let totalOrders = 0;
  let totalRevenue = 0;
  let totalCash = 0;
  let totalQris = 0;

  if (summaryRows) {
    totalOrders = summaryRows.length;
    for (const row of summaryRows) {
      if (row.payment_status === "lunas" && row.status !== "batal") {
        totalRevenue += row.total || 0;
        if (row.payment_method === "cash") {
          totalCash += row.total || 0;
        } else if (row.payment_method === "qris") {
          totalQris += row.total || 0;
        }
      }
    }
  }

  // 2. Ambil total count untuk paginasi
  const totalCount = totalOrders;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const offset = (page - 1) * limit;

  // 3. Ambil data pesanan terpaginasi beserta item-itemnya
  const ordersQuery = applyFilters(
    supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
  )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: ordersData, error } = await ordersQuery;

  if (error || !ordersData) {
    return {
      orders: [],
      totalCount: 0,
      summary: { totalOrders: 0, totalRevenue: 0, totalCash: 0, totalQris: 0 },
      page,
      totalPages: 1,
    };
  }

  return {
    orders: ordersData as AdminOrder[],
    totalCount,
    summary: {
      totalOrders,
      totalRevenue,
      totalCash,
      totalQris,
    },
    page,
    totalPages,
  };
}
```

- [ ] **Step 4: Jalankan tes unit dan pastikan lulus (GREEN)**

```bash
npx vitest run lib/admin-orders.test.ts
```

- [ ] **Step 5: Komit perubahan**

```bash
git add lib/admin-orders.ts lib/admin-orders.test.ts
git commit -m "feat(orders): implementasi fungsi query getOrderHistory beserta agregasi ringkasan"
```

---

### Task 3: Route Handler `app/api/admin/orders/history/route.ts` & API Unit Tests

**Files:**
- Create: `app/api/admin/orders/history/route.ts`
- Create: `app/api/admin/orders/history/history-api.test.ts`

**Interfaces:**
- Consumes:
  - `getAdminUser()` dari `lib/auth`
  - `createServerSupabaseClient()` dari `lib/supabase/server`
  - `orderHistoryQuerySchema`, `getOrderHistory` dari `lib/admin-orders`
- Produces:
  - `GET /api/admin/orders/history`: mengembalikan `{ orders, totalCount, summary, page, totalPages }`

- [ ] **Step 1: Tulis tes gagal (RED) di `app/api/admin/orders/history/history-api.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
  getAdminUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/admin-orders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-orders")>();
  return {
    ...actual,
    getOrderHistory: vi.fn(),
  };
});

describe("GET /api/admin/orders/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan 401 Unauthorized jika pemanggil tidak memiliki sesi admin", async () => {
    const { getAdminUser } = await import("@/lib/auth");
    vi.mocked(getAdminUser).mockResolvedValue(null);

    const req = new Request("http://localhost/api/admin/orders/history");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("mengembalikan 400 Bad Request jika parameter query tidak valid", async () => {
    const { getAdminUser } = await import("@/lib/auth");
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@test.com" } as any);

    const req = new Request("http://localhost/api/admin/orders/history?preset=custom&from=invalid-date");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("mengembalikan 200 OK dengan payload data riwayat pesanan yang valid", async () => {
    const { getAdminUser } = await import("@/lib/auth");
    const { getOrderHistory } = await import("@/lib/admin-orders");
    vi.mocked(getAdminUser).mockResolvedValue({ id: "admin-1", email: "admin@test.com" } as any);

    const mockResult = {
      orders: [],
      totalCount: 0,
      summary: { totalOrders: 0, totalRevenue: 0, totalCash: 0, totalQris: 0 },
      page: 1,
      totalPages: 1,
    };
    vi.mocked(getOrderHistory).mockResolvedValue(mockResult);

    const req = new Request("http://localhost/api/admin/orders/history?preset=today&status=all");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.orders).toEqual([]);
    expect(json.summary.totalRevenue).toBe(0);
    expect(getOrderHistory).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan tes untuk memverifikasi kegagalan (RED)**

```bash
npx vitest run app/api/admin/orders/history/history-api.test.ts
```

- [ ] **Step 3: Implementasikan route handler di `app/api/admin/orders/history/route.ts` (GREEN)**

```typescript
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { orderHistoryQuerySchema, getOrderHistory } from "@/lib/admin-orders";

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawParams: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    rawParams[key] = val;
  });

  const parsed = orderHistoryQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Parameter query tidak valid.";
    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const result = await getOrderHistory(supabase, parsed.data);

  return NextResponse.json(result);
}
```

- [ ] **Step 4: Jalankan tes unit API dan pastikan lulus (GREEN)**

```bash
npx vitest run app/api/admin/orders/history/history-api.test.ts
```

- [ ] **Step 5: Komit perubahan**

```bash
git add app/api/admin/orders/history/route.ts app/api/admin/orders/history/history-api.test.ts
git commit -m "feat(api): endpoint GET riwayat pesanan dengan validasi query dan otentikasi admin"
```

---

### Task 4: Komponen UI Filter Bar, Summary Cards, & Pagination

**Files:**
- Create: `components/admin/history/history-filter-bar.tsx`
- Create: `components/admin/history/history-summary-cards.tsx`
- Create: `components/admin/history/history-pagination.tsx`

**Interfaces:**
- `HistoryFilterBar`: menerima `currentParams: OrderHistoryQuery` dan memicu navigasi URL via `router.push`.
- `HistorySummaryCards`: menerima `summary: OrderHistorySummary`.
- `HistoryPagination`: menerima `page: number`, `totalPages: number`, dan `buildPageUrl: (page: number) => string`.

- [ ] **Step 1: Buat `components/admin/history/history-summary-cards.tsx`**

Komponen kartu ringkasan omzet dan total pesanan:
- Menampilkan Total Pesanan dan Total Omzet Lunas (`formatRupiah`).
- Kontras teks tinggi (`text-ink-900`, `text-ink-600`), latar `bg-card border-line`.

- [ ] **Step 2: Buat `components/admin/history/history-filter-bar.tsx`**

Komponen bar filter:
- Preset buttons: Hari Ini, Kemarin, 7 Hari, 30 Hari, Kustom (target sentuh >= 44px).
- Input tanggal mulai & tanggal selesai saat preset Kustom aktif.
- Dropdown select Status: Semua Status, Selesai, Batal.
- Search input dengan ikon pencarian untuk filter nama / nomor antrean.
- Tombol Reset jika filter aktif berbeda dari default.
- Memperbarui query params di URL tanpa reload penuh (`router.push`).

- [ ] **Step 3: Buat `components/admin/history/history-pagination.tsx`**

Komponen paginasi:
- Tombol "Sebelumnya" (disabled jika `page <= 1`, min 44px).
- Teks indikator "Halaman X dari Y".
- Tombol "Selanjutnya" (disabled jika `page >= totalPages`, min 44px).

- [ ] **Step 4: Verifikasi build dan linting**

```bash
npm run lint
npm run typecheck
```

- [ ] **Step 5: Komit perubahan**

```bash
git add components/admin/history/
git commit -m "feat(admin): buat komponen filter bar, summary cards, dan paginasi riwayat pesanan"
```

---

### Task 5: Komponen Detail Pesanan (`OrderDetailSheet`) & Halaman `/admin/riwayat/page.tsx`

**Files:**
- Create: `components/admin/history/order-detail-sheet.tsx`
- Create: `components/admin/history/history-order-list.tsx`
- Modify: `app/admin/(dashboard)/riwayat/page.tsx`

**Interfaces:**
- `OrderDetailSheet`: menerima `order: AdminOrder | null`, `isOpen: boolean`, `onClose: () => void`, dan `onOrderUpdated?: () => void`.
- `HistoryOrderList`: menerima `orders: AdminOrder[]` dan `onSelectOrder: (order: AdminOrder) => void`.

- [ ] **Step 1: Buat `components/admin/history/order-detail-sheet.tsx`**

Drawer / Dialog detail pesanan:
- Menggunakan `Sheet` (Bottom Sheet pada mobile < 768px) dan `Dialog` (pada desktop >= 768px).
- Menampilkan rincian pesanan lengkap:
  - Header: `#daily_number`, jenis pesanan (`Dine In` / `Bungkus`), waktu pesan WITA.
  - Nama pelanggan dan nomor telepon.
  - Daftar item pesanan: kuantitas, nama item, opsi tambahan (`+Rp X`), catatan khusus, dan subtotal.
  - Total pembayaran, metode bayar (QRIS/Cash), status masak, status bayar.
  - Alasan pembatalan jika pesanan berstatus `batal`.
  - Aksi Koreksi: Tombol **"Tandai Lunas"** jika `payment_status !== 'lunas'` dan `status === 'selesai'`.
    - Memanggil `PATCH /api/admin/orders/[id]` dengan `{ action: "tandai_lunas" }`.
    - Menampilkan status loading dan menangani error secara ramah.
    - Memanggil `router.refresh()` setelah sukses untuk menyegarkan data.

- [ ] **Step 2: Buat `components/admin/history/history-order-list.tsx`**

Komponen daftar kartu pesanan:
- Menampilkan kartu-kartu pesanan berurutan.
- Setiap kartu interaktif memiliki target sentuh >= 44px, border `border-line`, background `bg-card`.
- Badge visual status masak (`baru`, `dimasak`, `siap`, `selesai`, `batal`) dan status bayar (`belum_bayar`, `menunggu_verifikasi`, `lunas`).
- Empty state ramah jika `orders.length === 0`: pesan informatif bahwa tidak ada pesanan pada rentang/pencarian tersebut, dilengkapi tombol "Kembali ke Hari Ini".

- [ ] **Step 3: Implementasikan Server Component di `app/admin/(dashboard)/riwayat/page.tsx`**

Halaman utama riwayat pesanan:
- Memverifikasi otentikasi admin via `getAdminUser()`.
- Membaca `searchParams` (`preset`, `from`, `to`, `status`, `search`, `page`).
- Mengambil data melalui `getOrderHistory(supabase, query)`.
- Merender `HistoryFilterBar`, `HistorySummaryCards`, `HistoryOrderList`, `HistoryPagination`, dan mengintegrasikan `OrderDetailSheet`.
- Layout rapi responsif mobile 360px tanpa horizontal scroll.

- [ ] **Step 4: Verifikasi lint, typecheck, dan build**

```bash
npm run lint
npm run typecheck
npm run build
```

- [ ] **Step 5: Komit perubahan**

```bash
git add components/admin/history/ app/admin/\(dashboard\)/riwayat/page.tsx
git commit -m "feat(admin): implementasi halaman riwayat pesanan dan modal detail pesanan responsif"
```

---

### Task 6: Pengujian End-to-End Playwright & Sinkronisasi Roadmap

**Files:**
- Create: `e2e/admin-history.spec.ts`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Menguji alur pengguna riwayat pesanan secara menyeluruh pada viewport mobile (360px/390px) dan desktop:
  - Login admin.
  - Navigasi ke `/admin/riwayat`.
  - Verifikasi kartu pesanan dan ringkasan metrik tampil.
  - Filter preset tanggal (Kemarin, 7 Hari Terakhir) dan filter status.
  - Pencarian nama pelanggan.
  - Klik kartu pesanan untuk membuka Detail Sheet/Modal dan verifikasi data rincian item/opsi.
  - Menekan tombol "Tandai Lunas" pada pesanan yang belum lunas dan memastikan statusnya berganti menjadi Lunas.
- Menandai checklist Milestone M5 di `docs/roadmap.md`.

- [ ] **Step 1: Tulis tes E2E di `e2e/admin-history.spec.ts`**

Gunakan fixture pesanan uji sintetis dengan teardown bersih di `afterAll`:

```typescript
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const isLocal = supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

test.describe("Admin History Orders Flow", () => {
  test.skip(!isLocal || !serviceRoleKey, "Hanya dijalankan pada Supabase lokal.");

  // Fixture setup & teardown
  // Login admin -> Buka /admin/riwayat
  // Uji filter preset, pencarian, detail sheet, dan tombol Tandai Lunas
});
```

- [ ] **Step 2: Update `docs/roadmap.md`**

Tandai item milestone M5:
`- [x] Riwayat dengan filter tanggal + detail`

- [ ] **Step 3: Jalankan verifikasi lokal lengkap**

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- [ ] **Step 4: Komit perubahan**

```bash
git add e2e/admin-history.spec.ts docs/roadmap.md
git commit -m "test(e2e): tambah pengujian alur riwayat pesanan dan sinkronkan roadmap"
```

---

## Rencana Eksekusi Subagent

Setiap task di atas dieksekusi secara terpisah oleh subagent implementer yang dibuat baru:
1. **Subagent Task 1**: TDD skema validasi Zod & helper tanggal WITA.
2. **Subagent Task 2**: TDD query helper `getOrderHistory` & agregasi omzet.
3. **Subagent Task 3**: TDD route handler `GET /api/admin/orders/history`.
4. **Subagent Task 4**: Komponen filter bar, summary cards, & pagination.
5. **Subagent Task 5**: Komponen `OrderDetailSheet` & halaman `/admin/riwayat/page.tsx`.
6. **Subagent Task 6**: Playwright E2E test `e2e/admin-history.spec.ts` & sinkronisasi roadmap.
