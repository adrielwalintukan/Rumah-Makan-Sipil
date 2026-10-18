import { describe, expect, it } from "vitest";
import {
  categorySchema,
  menuItemSchema,
  quickToggleAvailabilitySchema,
  reorderSchema,
} from "./admin-menu-schemas";

describe("admin-menu-schemas", () => {
  describe("categorySchema", () => {
    it("memvalidasi kategori yang valid", () => {
      const valid = { name: "Makanan Utama", sort_order: 1 };
      const res = categorySchema.safeParse(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Makanan Utama");
        expect(res.data.sort_order).toBe(1);
      }
    });

    it("menolak kategori dengan nama kosong atau hanya whitespace", () => {
      const invalid = { name: "   ", sort_order: 1 };
      const res = categorySchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it("membiarkan sort_order undefined jika tidak disediakan", () => {
      const res = categorySchema.safeParse({ name: "Minuman" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.sort_order).toBeUndefined();
      }
    });

    it("menolak nama kategori melebihi 50 karakter", () => {
      const res = categorySchema.safeParse({ name: "A".repeat(51) });
      expect(res.success).toBe(false);
    });

    it("menolak properti asing yang tidak dikenal (strict mode)", () => {
      const res = categorySchema.safeParse({
        name: "Makanan",
        sort_order: 1,
        extra_field: "unknown",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("menuItemSchema", () => {
    it("memvalidasi menu dengan harga bulat valid", () => {
      const valid = {
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto Ayam Kampung",
        description: "Kuah rempah khas Makassar",
        price: 18000,
        is_available: true,
        sort_order: 0,
      };
      const res = menuItemSchema.safeParse(valid);
      expect(res.success).toBe(true);
    });

    it("menolak harga negatif atau desimal", () => {
      const resNeg = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: -5000,
      });
      expect(resNeg.success).toBe(false);

      const resFloat = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000.5,
      });
      expect(resFloat.success).toBe(false);
    });

    it("menolak category_id yang bukan UUID", () => {
      const res = menuItemSchema.safeParse({
        category_id: "invalid-uuid",
        name: "Cotto",
        price: 15000,
      });
      expect(res.success).toBe(false);
    });

    it("menolak nama menu kosong atau melebihi 100 karakter", () => {
      const resEmpty = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "   ",
        price: 15000,
      });
      expect(resEmpty.success).toBe(false);

      const resTooLong = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "A".repeat(101),
        price: 15000,
      });
      expect(resTooLong.success).toBe(false);
    });

    it("mengisi nilai default untuk description dan is_available, serta membiarkan sort_order opsional", () => {
      const res = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Es Teh Manis",
        price: 5000,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.description).toBe("");
        expect(res.data.is_available).toBe(true);
        expect(res.data.sort_order).toBeUndefined();
      }
    });

    it("menerima image_path yang valid (path relatif), null, atau undefined", () => {
      const base = {
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
      };

      const resValid = menuItemSchema.safeParse({
        ...base,
        image_path: "items/cotto.webp",
      });
      expect(resValid.success).toBe(true);
      if (resValid.success) {
        expect(resValid.data.image_path).toBe("items/cotto.webp");
      }

      const resNull = menuItemSchema.safeParse({
        ...base,
        image_path: null,
      });
      expect(resNull.success).toBe(true);
      if (resNull.success) {
        expect(resNull.data.image_path).toBeNull();
      }

      const resUndefined = menuItemSchema.safeParse({
        ...base,
      });
      expect(resUndefined.success).toBe(true);
      if (resUndefined.success) {
        expect(resUndefined.data.image_path).toBeUndefined();
      }
    });

    it("melakukan trim pada image_path", () => {
      const res = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
        image_path: "   items/cotto.webp   ",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.image_path).toBe("items/cotto.webp");
      }
    });

    it("menormalkan string kosong atau whitespace-only pada image_path menjadi null", () => {
      const resEmpty = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
        image_path: "",
      });
      expect(resEmpty.success).toBe(true);
      if (resEmpty.success) {
        expect(resEmpty.data.image_path).toBeNull();
      }

      const resWhitespace = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
        image_path: "     ",
      });
      expect(resWhitespace.success).toBe(true);
      if (resWhitespace.success) {
        expect(resWhitespace.data.image_path).toBeNull();
      }
    });

    it("menolak image_path yang melebihi 255 karakter", () => {
      const res = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
        image_path: "a".repeat(256),
      });
      expect(res.success).toBe(false);
    });

    it("menolak image_path dengan tipe data salah (bukan string atau null/undefined)", () => {
      const resNumber = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
        image_path: 12345,
      });
      expect(resNumber.success).toBe(false);

      const resObject = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
        image_path: { url: "items/cotto.webp" },
      });
      expect(resObject.success).toBe(false);
    });

    it("menolak properti asing yang tidak dikenal (strict mode)", () => {
      const res = menuItemSchema.safeParse({
        category_id: "a0000000-0000-0000-0000-000000000001",
        name: "Cotto",
        price: 15000,
        extra_key: "not allowed",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("quickToggleAvailabilitySchema", () => {
    it("memvalidasi perubahan is_available boolean", () => {
      const resTrue = quickToggleAvailabilitySchema.safeParse({ is_available: true });
      expect(resTrue.success).toBe(true);

      const resFalse = quickToggleAvailabilitySchema.safeParse({ is_available: false });
      expect(resFalse.success).toBe(true);
    });

    it("menolak nilai is_available yang bukan boolean", () => {
      const res = quickToggleAvailabilitySchema.safeParse({ is_available: "yes" });
      expect(res.success).toBe(false);
    });

    it("menolak properti asing yang tidak dikenal (strict mode)", () => {
      const res = quickToggleAvailabilitySchema.safeParse({
        is_available: true,
        extra: "unknown",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("reorderSchema", () => {
    it("memvalidasi daftar id dan sort_order", () => {
      const res = reorderSchema.safeParse({
        items: [
          { id: "a0000000-0000-0000-0000-000000000001", sort_order: 0 },
          { id: "a0000000-0000-0000-0000-000000000002", sort_order: 1 },
        ],
      });
      expect(res.success).toBe(true);
    });

    it("menolak jika daftar items kosong", () => {
      const res = reorderSchema.safeParse({
        items: [],
      });
      expect(res.success).toBe(false);
    });

    it("menolak id item yang bukan UUID atau sort_order negatif", () => {
      const resInvalidUuid = reorderSchema.safeParse({
        items: [{ id: "not-a-uuid", sort_order: 0 }],
      });
      expect(resInvalidUuid.success).toBe(false);

      const resNegSort = reorderSchema.safeParse({
        items: [{ id: "a0000000-0000-0000-0000-000000000001", sort_order: -1 }],
      });
      expect(resNegSort.success).toBe(false);
    });

    it("menolak properti asing pada root maupun item urutan (strict mode)", () => {
      const resRootExtra = reorderSchema.safeParse({
        items: [{ id: "a0000000-0000-0000-0000-000000000001", sort_order: 0 }],
        extra_root: 123,
      });
      expect(resRootExtra.success).toBe(false);

      const resItemExtra = reorderSchema.safeParse({
        items: [{ id: "a0000000-0000-0000-0000-000000000001", sort_order: 0, extra_item: "foo" }],
      });
      expect(resItemExtra.success).toBe(false);
    });
  });
});
