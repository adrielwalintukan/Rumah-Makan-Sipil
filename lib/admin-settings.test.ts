import { describe, expect, it } from "vitest";
import {
  STORE_QRIS_PATH_REGEX,
  updateStoreSettingsSchema,
  updateStoreStatusSchema,
} from "./admin-settings";

describe("updateStoreStatusSchema", () => {
  it("menerima nilai boolean true", () => {
    const res = updateStoreStatusSchema.safeParse({ is_open: true });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.is_open).toBe(true);
    }
  });

  it("menerima nilai boolean false", () => {
    const res = updateStoreStatusSchema.safeParse({ is_open: false });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.is_open).toBe(false);
    }
  });

  it("menolak nilai non-boolean atau kosong", () => {
    expect(updateStoreStatusSchema.safeParse({}).success).toBe(false);
    expect(updateStoreStatusSchema.safeParse({ is_open: "true" }).success).toBe(false);
    expect(updateStoreStatusSchema.safeParse({ is_open: 1 }).success).toBe(false);
    expect(updateStoreStatusSchema.safeParse({ is_open: null }).success).toBe(false);
  });
});

describe("STORE_QRIS_PATH_REGEX", () => {
  it("mencocokkan path valid dalam direktori qris/ dengan ekstensi yang diizinkan", () => {
    expect(STORE_QRIS_PATH_REGEX.test("qris/qris-dana.webp")).toBe(true);
    expect(STORE_QRIS_PATH_REGEX.test("qris/dana_123.jpg")).toBe(true);
    expect(STORE_QRIS_PATH_REGEX.test("qris/store-qris-2026.jpeg")).toBe(true);
    expect(STORE_QRIS_PATH_REGEX.test("qris/myQRIS.png")).toBe(true);
  });

  it("menolak path di luar folder qris/, path traversal, atau ekstensi yang tidak diizinkan", () => {
    expect(STORE_QRIS_PATH_REGEX.test("items/menu.webp")).toBe(false);
    expect(STORE_QRIS_PATH_REGEX.test("qris-dana.webp")).toBe(false);
    expect(STORE_QRIS_PATH_REGEX.test("qris/sub/qris.webp")).toBe(false);
    expect(STORE_QRIS_PATH_REGEX.test("qris/../secret.png")).toBe(false);
    expect(STORE_QRIS_PATH_REGEX.test("qris/qris.gif")).toBe(false);
    expect(STORE_QRIS_PATH_REGEX.test("qris/qris.svg")).toBe(false);
    expect(STORE_QRIS_PATH_REGEX.test("qris/qris.webp/extra")).toBe(false);
  });
});

describe("updateStoreSettingsSchema", () => {
  const validPayload = {
    store_name: "Rumah Makan Sipil",
    tagline: "Spesial Masakan Rumahan",
    whatsapp_number: "62895806567230",
    dos_price: 2000,
    qris_image_path: "qris/qris-dana.webp",
    is_open: true,
  };

  it("menerima payload valid lengkap", () => {
    const res = updateStoreSettingsSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual({
        store_name: "Rumah Makan Sipil",
        tagline: "Spesial Masakan Rumahan",
        whatsapp_number: "62895806567230",
        dos_price: 2000,
        qris_image_path: "qris/qris-dana.webp",
        is_open: true,
      });
    }
  });

  it("menerima payload tanpa is_open (opsional)", () => {
    const payloadWithoutIsOpen = {
      store_name: validPayload.store_name,
      tagline: validPayload.tagline,
      whatsapp_number: validPayload.whatsapp_number,
      dos_price: validPayload.dos_price,
      qris_image_path: validPayload.qris_image_path,
    };
    const res = updateStoreSettingsSchema.safeParse(payloadWithoutIsOpen);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.is_open).toBeUndefined();
    }
  });

  describe("store_name", () => {
    it("menolak store_name kosong atau hanya whitespace", () => {
      const resEmpty = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        store_name: "",
      });
      expect(resEmpty.success).toBe(false);

      const resWhitespace = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        store_name: "   ",
      });
      expect(resWhitespace.success).toBe(false);
    });

    it("menolak store_name lebih dari 100 karakter", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        store_name: "a".repeat(101),
      });
      expect(res.success).toBe(false);
    });

    it("melakukan trim pada store_name", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        store_name: "  Rumah Makan Sipil  ",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.store_name).toBe("Rumah Makan Sipil");
      }
    });
  });

  describe("tagline", () => {
    it("menolak tagline lebih dari 150 karakter", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        tagline: "a".repeat(151),
      });
      expect(res.success).toBe(false);
    });

    it("mengonversi tagline string kosong menjadi null", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        tagline: "",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tagline).toBeNull();
      }
    });

    it("mengonversi tagline whitespace saja menjadi null", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        tagline: "   ",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.tagline).toBeNull();
      }
    });

    it("menerima tagline null atau undefined", () => {
      const resNull = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        tagline: null,
      });
      expect(resNull.success).toBe(true);
      if (resNull.success) {
        expect(resNull.data.tagline).toBeNull();
      }

      const payloadWithoutTagline = {
        store_name: validPayload.store_name,
        whatsapp_number: validPayload.whatsapp_number,
        dos_price: validPayload.dos_price,
        qris_image_path: validPayload.qris_image_path,
        is_open: validPayload.is_open,
      };
      const resUndef = updateStoreSettingsSchema.safeParse(payloadWithoutTagline);
      expect(resUndef.success).toBe(true);
      if (resUndef.success) {
        expect(resUndef.data.tagline).toBeUndefined();
      }
    });
  });

  describe("whatsapp_number", () => {
    it("menerima nomor valid diawali 62 dengan 8 sampai 13 digit setelahnya", () => {
      // 8 digit setelah 62 (total 10 digit)
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "62812345678",
        }).success
      ).toBe(true);

      // 12 digit setelah 62 (contoh: 62895806567230)
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "62895806567230",
        }).success
      ).toBe(true);

      // 13 digit setelah 62 (total 15 digit)
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "628123456789012",
        }).success
      ).toBe(true);
    });

    it("menolak format nomor WhatsApp salah", () => {
      // Awalan 08
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "0895806567230",
        }).success
      ).toBe(false);

      // Awalan +62
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "+62895806567230",
        }).success
      ).toBe(false);

      // Kurang digit (hanya 7 digit setelah 62)
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "621234567",
        }).success
      ).toBe(false);

      // Lebih digit (14 digit setelah 62)
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "6281234567890123",
        }).success
      ).toBe(false);

      // Ada karakter non-digit
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "62895-8065-67230",
        }).success
      ).toBe(false);

      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          whatsapp_number: "6289580abc230",
        }).success
      ).toBe(false);
    });
  });

  describe("dos_price", () => {
    it("menerima harga 0 atau bilangan bulat positif", () => {
      const resZero = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        dos_price: 0,
      });
      expect(resZero.success).toBe(true);
      if (resZero.success) {
        expect(resZero.data.dos_price).toBe(0);
      }

      const resPositive = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        dos_price: 2500,
      });
      expect(resPositive.success).toBe(true);
      if (resPositive.success) {
        expect(resPositive.data.dos_price).toBe(2500);
      }
    });

    it("menolak dos_price negatif", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        dos_price: -1,
      });
      expect(res.success).toBe(false);
    });

    it("menolak dos_price pecahan / non-integer", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        dos_price: 2000.5,
      });
      expect(res.success).toBe(false);
    });

    it("menolak dos_price string atau non-number", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        dos_price: "2000",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("qris_image_path", () => {
    it("menerima format path QRIS valid", () => {
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          qris_image_path: "qris/qris-dana.webp",
        }).success
      ).toBe(true);

      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          qris_image_path: "qris/store_qris_01.png",
        }).success
      ).toBe(true);

      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          qris_image_path: "qris/qris.jpg",
        }).success
      ).toBe(true);

      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          qris_image_path: "qris/qris.jpeg",
        }).success
      ).toBe(true);
    });

    it("menerima null atau undefined", () => {
      const resNull = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        qris_image_path: null,
      });
      expect(resNull.success).toBe(true);
      if (resNull.success) {
        expect(resNull.data.qris_image_path).toBeNull();
      }

      const payloadWithoutQris = {
        store_name: validPayload.store_name,
        tagline: validPayload.tagline,
        whatsapp_number: validPayload.whatsapp_number,
        dos_price: validPayload.dos_price,
        is_open: validPayload.is_open,
      };
      const resUndef = updateStoreSettingsSchema.safeParse(payloadWithoutQris);
      expect(resUndef.success).toBe(true);
      if (resUndef.success) {
        expect(resUndef.data.qris_image_path).toBeUndefined();
      }
    });

    it("mengonversi string kosong atau whitespace menjadi null", () => {
      const resEmpty = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        qris_image_path: "",
      });
      expect(resEmpty.success).toBe(true);
      if (resEmpty.success) {
        expect(resEmpty.data.qris_image_path).toBeNull();
      }

      const resWhitespace = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        qris_image_path: "   ",
      });
      expect(resWhitespace.success).toBe(true);
      if (resWhitespace.success) {
        expect(resWhitespace.data.qris_image_path).toBeNull();
      }
    });

    it("menolak direktori salah, ekstensi tidak didukung, atau path traversal", () => {
      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          qris_image_path: "items/qris.webp",
        }).success
      ).toBe(false);

      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          qris_image_path: "qris/qris.gif",
        }).success
      ).toBe(false);

      expect(
        updateStoreSettingsSchema.safeParse({
          ...validPayload,
          qris_image_path: "qris/../secret.png",
        }).success
      ).toBe(false);
    });
  });

  describe("strict validation", () => {
    it("menolak field tambahan yang tidak dikenal", () => {
      const res = updateStoreSettingsSchema.safeParse({
        ...validPayload,
        unrecognized_field: "injeksi nilai",
      });
      expect(res.success).toBe(false);
    });
  });
});
