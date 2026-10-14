import { expect, test } from "@playwright/test";

test("beranda bermerek tampil di HP tanpa scroll horizontal", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Rumah Makan Sipil");
  await expect(page.getByRole("heading", { level: 1, name: "SIPIL" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("link", { name: "Hubungi via WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/62895806567230",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
