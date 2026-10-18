import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMenuPhotoUrl, MENU_PHOTOS_BUCKET } from "./storage";

describe("storage", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
  });

  it("mengekspor MENU_PHOTOS_BUCKET yang benar", () => {
    expect(MENU_PHOTOS_BUCKET).toBe("menu-photos");
  });

  describe("getMenuPhotoUrl", () => {
    it("mengembalikan null untuk null, undefined, atau string kosong", () => {
      expect(getMenuPhotoUrl(null)).toBeNull();
      expect(getMenuPhotoUrl(undefined)).toBeNull();
      expect(getMenuPhotoUrl("")).toBeNull();
      expect(getMenuPhotoUrl("   ")).toBeNull();
    });

    it("mengembalikan URL publik Supabase Storage lengkap untuk path relatif", () => {
      const url = getMenuPhotoUrl("items/ayam-bakar.webp");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/menu-photos/items/ayam-bakar.webp"
      );
    });

    it("menghapus whitespace di awal dan akhir path relatif", () => {
      const url = getMenuPhotoUrl("   items/ayam-bakar.webp   ");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/menu-photos/items/ayam-bakar.webp"
      );
    });

    it("menangani trailing slash pada NEXT_PUBLIC_SUPABASE_URL dan leading slash pada path", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
      const url = getMenuPhotoUrl("items/ayam-bakar.webp");
      expect(url).toBe(
        "https://example.supabase.co/storage/v1/object/public/menu-photos/items/ayam-bakar.webp"
      );
    });

    it("mengembalikan path apa adanya jika sudah diawali http://, https://, atau /", () => {
      expect(getMenuPhotoUrl("https://images.example.com/foto.jpg")).toBe(
        "https://images.example.com/foto.jpg"
      );
      expect(getMenuPhotoUrl("http://images.example.com/foto.jpg")).toBe(
        "http://images.example.com/foto.jpg"
      );
      expect(getMenuPhotoUrl("/custom/static/path.webp")).toBe(
        "/custom/static/path.webp"
      );
    });

    it("mengembalikan fallback path jika NEXT_PUBLIC_SUPABASE_URL tidak didefinisikan", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      const url = getMenuPhotoUrl("items/ayam-bakar.webp");
      expect(url).toBe("/menu-photos/items/ayam-bakar.webp");
    });
  });
});
