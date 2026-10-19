import "server-only";
import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getMenuPhotoUrl } from "@/lib/storage";

export type MenuOption = { id: string; name: string; price_delta: number; is_available: boolean };
export type OptionGroup = {
  id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  options: MenuOption[];
};
export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  option_groups: OptionGroup[];
};
export type Category = { id: string; name: string; items: MenuItem[] };
export type StoreSettings = {
  is_open: boolean;
  store_name: string;
  tagline: string | null;
  whatsapp_number: string;
  dos_price: number;
};
export type Menu = { categories: Category[]; settings: StoreSettings };

const bySort = <T extends { sort_order: number; name?: string }>(a: T, b: T) =>
  a.sort_order - b.sort_order || (a.name ?? "").localeCompare(b.name ?? "");

/** Menu aktif + pengaturan toko, selalu segar (toggle Habis/Buka harus langsung terlihat). */
export async function getMenu(): Promise<Menu> {
  await connection();
  const supabase = createPublicClient();
  const [menu, settings] = await Promise.all([
    supabase
      .from("categories")
      .select(
        "id, name, sort_order, menu_items(id, name, description, price, image_path, is_available, sort_order, option_groups(id, name, type, required, sort_order, options(id, name, price_delta, is_available, sort_order)))",
      ),
    supabase.from("settings").select("is_open, store_name, tagline, whatsapp_number, dos_price").single(),
  ]);
  if (menu.error) throw menu.error;
  if (settings.error) throw settings.error;

  const categories = menu.data
    .sort(bySort)
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: c.menu_items.sort(bySort).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: m.price,
        image_url: getMenuPhotoUrl(m.image_path),
        is_available: m.is_available,
        option_groups: m.option_groups.sort(bySort).map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type as OptionGroup["type"],
          required: g.required,
          options: g.options.sort(bySort).map(({ id, name, price_delta, is_available }: MenuOption) => ({
            id,
            name,
            price_delta,
            is_available,
          })),
        })),
      })),
    }))
    .filter((c) => c.items.length > 0);

  return { categories, settings: settings.data };
}
