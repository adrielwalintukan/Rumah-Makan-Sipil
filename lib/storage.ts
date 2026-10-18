export const MENU_PHOTOS_BUCKET = "menu-photos";

/**
 * Menghasilkan URL publik untuk foto menu berdasarkan image_path dari database.
 * Mendukung path relatif Supabase Storage, URL absolut (http/https), atau path publik lokal.
 */
export function getMenuPhotoUrl(imagePath?: string | null): string | null {
  if (!imagePath || !imagePath.trim()) return null;
  const trimmed = imagePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${MENU_PHOTOS_BUCKET}/${trimmed}`;
  }
  return `/${MENU_PHOTOS_BUCKET}/${trimmed}`;
}
