import { describe, expect, it } from "vitest";
import {
  categorySchema,
  menuItemSchema,
  menuItemWithGroupsSchema,
  optionGroupSchema,
  optionSchema,
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

    it("menolak image_path berupa URL eksternal, path traversal, leading slash, atau folder luar items/", () => {
      const invalidPaths = [
        "https://external.com/photo.jpg",
        "http://malicious.site/pic.png",
        "//external.com/photo.webp",
        "/items/cotto.webp",
        "items/../secret.webp",
        "../items/cotto.webp",
        "uploads/cotto.webp",
        "items/sub/cotto.webp",
        "items/cotto.exe",
        "items/cotto.php",
      ];

      for (const invalidPath of invalidPaths) {
        const res = menuItemSchema.safeParse({
          category_id: "a0000000-0000-0000-0000-000000000001",
          name: "Cotto",
          price: 15000,
          image_path: invalidPath,
        });
        expect(res.success, `seharusnya menolak path: ${invalidPath}`).toBe(false);
      }
    });

    it("menerima image_path format UUID webp dan ekstensi gambar yang diizinkan di items/", () => {
      const validPaths = [
        "items/550e8400-e29b-41d4-a716-446655440000.webp",
        "items/cotto-spesial_01.jpg",
        "items/es-teh.jpeg",
        "items/pisang-goreng.png",
      ];

      for (const validPath of validPaths) {
        const res = menuItemSchema.safeParse({
          category_id: "a0000000-0000-0000-0000-000000000001",
          name: "Cotto",
          price: 15000,
          image_path: validPath,
        });
        expect(res.success, `seharusnya menerima path: ${validPath}`).toBe(true);
      }
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

  describe("optionSchema", () => {
    it("memvalidasi opsi lengkap dengan id dan seluruh field valid", () => {
      const valid = {
        id: "b0000000-0000-0000-0000-000000000001",
        name: "Dingin",
        price_delta: 2000,
        is_available: true,
        sort_order: 1,
      };
      const res = optionSchema.safeParse(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBe("b0000000-0000-0000-0000-000000000001");
        expect(res.data.name).toBe("Dingin");
        expect(res.data.price_delta).toBe(2000);
        expect(res.data.is_available).toBe(true);
        expect(res.data.sort_order).toBe(1);
      }
    });

    it("mengisi nilai default untuk price_delta (0), is_available (true), sort_order (0), dan membiarkan id undefined", () => {
      const res = optionSchema.safeParse({ name: "Panas" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBeUndefined();
        expect(res.data.name).toBe("Panas");
        expect(res.data.price_delta).toBe(0);
        expect(res.data.is_available).toBe(true);
        expect(res.data.sort_order).toBe(0);
      }
    });

    it("melakukan trim pada nama opsi", () => {
      const res = optionSchema.safeParse({ name: "   Sedang   " });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Sedang");
      }
    });

    it("menolak nama opsi kosong atau hanya whitespace", () => {
      const resEmpty = optionSchema.safeParse({ name: "" });
      expect(resEmpty.success).toBe(false);

      const resWhitespace = optionSchema.safeParse({ name: "   " });
      expect(resWhitespace.success).toBe(false);
    });

    it("menolak nama opsi melebihi 50 karakter", () => {
      const res = optionSchema.safeParse({ name: "A".repeat(51) });
      expect(res.success).toBe(false);
    });

    it("menolak price_delta negatif atau desimal", () => {
      const resNeg = optionSchema.safeParse({ name: "Dingin", price_delta: -1000 });
      expect(resNeg.success).toBe(false);

      const resFloat = optionSchema.safeParse({ name: "Dingin", price_delta: 1500.5 });
      expect(resFloat.success).toBe(false);
    });

    it("menolak sort_order negatif atau desimal", () => {
      const resNeg = optionSchema.safeParse({ name: "Dingin", sort_order: -1 });
      expect(resNeg.success).toBe(false);

      const resFloat = optionSchema.safeParse({ name: "Dingin", sort_order: 1.5 });
      expect(resFloat.success).toBe(false);
    });

    it("menolak id yang bukan UUID", () => {
      const res = optionSchema.safeParse({ id: "invalid-uuid", name: "Dingin" });
      expect(res.success).toBe(false);
    });

    it("menolak properti asing yang tidak dikenal (strict mode)", () => {
      const res = optionSchema.safeParse({
        name: "Dingin",
        extra: "not-allowed",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("optionGroupSchema", () => {
    const validOption = {
      name: "Panas",
      price_delta: 0,
      is_available: true,
      sort_order: 0,
    };

    it("memvalidasi grup lengkap dengan id dan tipe single", () => {
      const valid = {
        id: "c0000000-0000-0000-0000-000000000001",
        name: "Suhu Minuman",
        type: "single",
        required: true,
        sort_order: 1,
        options: [
          validOption,
          { name: "Dingin", price_delta: 2000, is_available: true, sort_order: 1 },
        ],
      };
      const res = optionGroupSchema.safeParse(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Suhu Minuman");
        expect(res.data.type).toBe("single");
        expect(res.data.required).toBe(true);
        expect(res.data.sort_order).toBe(1);
        expect(res.data.options).toHaveLength(2);
      }
    });

    it("memvalidasi grup dengan tipe multiple", () => {
      const valid = {
        name: "Topping Tambahan",
        type: "multiple",
        options: [
          { name: "Keju", price_delta: 3000 },
          { name: "Cokelat", price_delta: 2000 },
        ],
      };
      const res = optionGroupSchema.safeParse(valid);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.type).toBe("multiple");
      }
    });

    it("mengisi nilai default untuk required (false), sort_order (0), dan membiarkan id undefined", () => {
      const res = optionGroupSchema.safeParse({
        name: "Varian",
        type: "single",
        options: [validOption],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.id).toBeUndefined();
        expect(res.data.required).toBe(false);
        expect(res.data.sort_order).toBe(0);
      }
    });

    it("melakukan trim pada nama grup", () => {
      const res = optionGroupSchema.safeParse({
        name: "   Suhu Minuman   ",
        type: "single",
        options: [validOption],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Suhu Minuman");
      }
    });

    it("menolak nama grup kosong atau melebihi 50 karakter", () => {
      const resEmpty = optionGroupSchema.safeParse({
        name: "   ",
        type: "single",
        options: [validOption],
      });
      expect(resEmpty.success).toBe(false);

      const resTooLong = optionGroupSchema.safeParse({
        name: "A".repeat(51),
        type: "single",
        options: [validOption],
      });
      expect(resTooLong.success).toBe(false);
    });

    it("menolak tipe grup selain single atau multiple", () => {
      const res = optionGroupSchema.safeParse({
        name: "Varian",
        type: "dropdown",
        options: [validOption],
      });
      expect(res.success).toBe(false);
    });

    it("menolak grup tanpa opsi (array kosong)", () => {
      const res = optionGroupSchema.safeParse({
        name: "Varian",
        type: "single",
        options: [],
      });
      expect(res.success).toBe(false);
    });

    it("menolak jika options tidak didefinisikan", () => {
      const res = optionGroupSchema.safeParse({
        name: "Varian",
        type: "single",
      });
      expect(res.success).toBe(false);
    });

    it("menolak nama opsi duplikat dalam satu grup (case-insensitive & trim)", () => {
      const resExact = optionGroupSchema.safeParse({
        name: "Varian",
        type: "single",
        options: [
          { name: "Manis" },
          { name: "Manis" },
        ],
      });
      expect(resExact.success).toBe(false);

      const resCase = optionGroupSchema.safeParse({
        name: "Varian",
        type: "single",
        options: [
          { name: "Dingin" },
          { name: "   dingin   " },
        ],
      });
      expect(resCase.success).toBe(false);
    });

    it("menerima opsi dengan nama berbeda dalam satu grup", () => {
      const res = optionGroupSchema.safeParse({
        name: "Varian",
        type: "single",
        options: [
          { name: "Dingin" },
          { name: "Panas" },
        ],
      });
      expect(res.success).toBe(true);
    });

    it("menolak properti asing yang tidak dikenal (strict mode)", () => {
      const res = optionGroupSchema.safeParse({
        name: "Varian",
        type: "single",
        options: [validOption],
        extra: "not-allowed",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("menuItemWithGroupsSchema", () => {
    const baseItem = {
      category_id: "a0000000-0000-0000-0000-000000000001",
      name: "Kopi Tubruk",
      description: "Kopi hitam khas nusantara",
      price: 10000,
      is_available: true,
      sort_order: 0,
    };

    it("memvalidasi menu tanpa option_groups dan memberi default array kosong", () => {
      const res = menuItemWithGroupsSchema.safeParse(baseItem);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.option_groups).toEqual([]);
      }
    });

    it("memvalidasi menu dengan option_groups array kosong", () => {
      const res = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        option_groups: [],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.option_groups).toEqual([]);
      }
    });

    it("memvalidasi menu lengkap dengan grup pilihan dan opsi", () => {
      const res = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        option_groups: [
          {
            name: "Varian Suhu",
            type: "single",
            required: true,
            options: [
              { name: "Panas", price_delta: 0 },
              { name: "Dingin", price_delta: 2000 },
            ],
          },
          {
            name: "Level Manis",
            type: "single",
            required: false,
            options: [
              { name: "Normal", price_delta: 0 },
              { name: "Less Sugar", price_delta: 0 },
            ],
          },
        ],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.option_groups).toHaveLength(2);
        expect(res.data.option_groups[0].options).toHaveLength(2);
      }
    });

    it("menolak menu dengan nama grup pilihan duplikat (case-insensitive & trim)", () => {
      const resExact = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        option_groups: [
          {
            name: "Level Pedas",
            type: "single",
            options: [{ name: "Sedang" }],
          },
          {
            name: "Level Pedas",
            type: "single",
            options: [{ name: "Pedas Sekali" }],
          },
        ],
      });
      expect(resExact.success).toBe(false);

      const resCase = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        option_groups: [
          {
            name: "Varian Suhu",
            type: "single",
            options: [{ name: "Panas" }],
          },
          {
            name: "   varian suhu   ",
            type: "single",
            options: [{ name: "Dingin" }],
          },
        ],
      });
      expect(resCase.success).toBe(false);
    });

    it("mengizinkan nama opsi yang sama pada grup pilihan yang berbeda", () => {
      const res = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        option_groups: [
          {
            name: "Level Pedas",
            type: "single",
            options: [{ name: "Sedang" }],
          },
          {
            name: "Ukuran Porsi",
            type: "single",
            options: [{ name: "Sedang" }],
          },
        ],
      });
      expect(res.success).toBe(true);
    });

    it("menolak menu jika salah satu grup pilihannya tidak valid (misal tanpa opsi)", () => {
      const res = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        option_groups: [
          {
            name: "Varian Kosong",
            type: "single",
            options: [],
          },
        ],
      });
      expect(res.success).toBe(false);
    });

    it("mempertahankan validasi dasar menu item (seperti harga negatif ditolak)", () => {
      const res = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        price: -5000,
        option_groups: [],
      });
      expect(res.success).toBe(false);
    });

    it("menolak properti asing pada menu item (strict mode)", () => {
      const res = menuItemWithGroupsSchema.safeParse({
        ...baseItem,
        extra_root_prop: "not-allowed",
      });
      expect(res.success).toBe(false);
    });
  });
});
