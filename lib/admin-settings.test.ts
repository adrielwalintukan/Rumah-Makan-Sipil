import { describe, expect, it } from "vitest";
import { updateStoreStatusSchema } from "./admin-settings";

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
