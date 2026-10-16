import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getClientIp, hashIp } from "./ip";

describe("getClientIp & hashIp", () => {
  it("mengambil IP pertama dari header x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
    });
    expect(getClientIp(req)).toBe("203.0.113.195");
  });

  it("mengambil IP dari x-real-ip jika x-forwarded-for kosong", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.1" },
    });
    expect(getClientIp(req)).toBe("198.51.100.1");
  });

  it("fallback ke 127.0.0.1 jika tidak ada header IP", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("menghasilkan hash SHA-256 yang konsisten dengan salt", () => {
    const hash1 = hashIp("203.0.113.1", "test-salt");
    const hash2 = hashIp("203.0.113.1", "test-salt");
    const hash3 = hashIp("203.0.113.2", "test-salt");
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });
});
