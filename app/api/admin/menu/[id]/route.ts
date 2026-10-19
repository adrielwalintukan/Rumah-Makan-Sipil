import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  menuItemSchema,
  optionGroupSchema,
  type OptionGroupInput,
  quickToggleAvailabilitySchema,
} from "@/lib/admin-menu-schemas";
import { MENU_PHOTOS_BUCKET } from "@/lib/storage";
import { UUID_REGEX } from "@/lib/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "ID menu tidak valid." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("menu_items")
      .select(
        "id, category_id, name, description, price, image_path, is_available, sort_order, category:categories(id, name), option_groups(id, name, type, required, sort_order, options(id, name, price_delta, is_available, sort_order))"
      )
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Menu tidak ditemukan." },
        { status: 404 }
      );
    }

    if (Array.isArray((data as Record<string, unknown>).option_groups)) {
      const groups = (data as Record<string, unknown>).option_groups as Array<{
        sort_order: number;
        name: string;
        options?: Array<{ sort_order: number; name: string }>;
      }>;
      groups.sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name);
      });
      for (const group of groups) {
        if (Array.isArray(group.options)) {
          group.options.sort((a, b) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
            return a.name.localeCompare(b.name);
          });
        }
      }
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "ID menu tidak valid." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Format request body tidak valid." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Format request body tidak valid." },
      { status: 400 }
    );
  }

  const rawBody = body as Record<string, unknown>;
  const keys = Object.keys(rawBody);

  let updateData: Record<string, unknown> = {};
  let optionGroupsData: OptionGroupInput[] | undefined = undefined;

  if (keys.length === 1 && "is_available" in rawBody) {
    const parseResult = quickToggleAvailabilitySchema.safeParse(rawBody);
    if (!parseResult.success) {
      const errorMsg =
        parseResult.error.issues[0]?.message ??
        "Data toggle ketersediaan tidak valid.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    updateData = { is_available: parseResult.data.is_available };
  } else {
    const allowedKeys = [
      "category_id",
      "name",
      "description",
      "price",
      "image_path",
      "is_available",
      "sort_order",
      "option_groups",
    ];

    const hasInvalidKey = Object.keys(rawBody).some(
      (k) => !allowedKeys.includes(k)
    );
    if (hasInvalidKey) {
      return NextResponse.json(
        { error: "Data menu tidak valid." },
        { status: 400 }
      );
    }

    const hasAnyAllowedKey = allowedKeys.some((k) => k in rawBody);
    if (!hasAnyAllowedKey) {
      return NextResponse.json(
        { error: "Tidak ada data yang diperbarui." },
        { status: 400 }
      );
    }

    if ("option_groups" in rawBody) {
      const groupsSchema = z
        .array(optionGroupSchema)
        .superRefine((groups, ctx) => {
          const seenGroupNames = new Set<string>();
          for (let i = 0; i < groups.length; i++) {
            const grp = groups[i];
            if (typeof grp?.name !== "string") continue;
            const normalized = grp.name.trim().toLowerCase();
            if (seenGroupNames.has(normalized)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Nama grup pilihan "${grp.name.trim()}" tidak boleh duplikat dalam satu menu`,
                path: [i, "name"],
              });
            } else {
              seenGroupNames.add(normalized);
            }
          }
        });

      const groupsParse = groupsSchema.safeParse(rawBody.option_groups);
      if (!groupsParse.success) {
        const errorMsg =
          groupsParse.error.issues[0]?.message ??
          "Data grup pilihan tidak valid.";
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }
      optionGroupsData = groupsParse.data;
    }

    const menuFields = { ...rawBody };
    delete menuFields.option_groups;
    if (Object.keys(menuFields).length > 0) {
      const parseResult = menuItemSchema.partial().safeParse(menuFields);
      if (!parseResult.success) {
        const errorMsg =
          parseResult.error.issues[0]?.message ?? "Data menu tidak valid.";
        return NextResponse.json({ error: errorMsg }, { status: 400 });
      }

      if ("category_id" in rawBody && parseResult.data.category_id !== undefined) {
        updateData.category_id = parseResult.data.category_id;
      }
      if ("name" in rawBody && parseResult.data.name !== undefined) {
        updateData.name = parseResult.data.name;
      }
      if (
        "description" in rawBody &&
        parseResult.data.description !== undefined
      ) {
        updateData.description = parseResult.data.description;
      }
      if ("price" in rawBody && parseResult.data.price !== undefined) {
        updateData.price = parseResult.data.price;
      }
      if ("image_path" in rawBody) {
        updateData.image_path = parseResult.data.image_path ?? null;
      }
      if (
        "is_available" in rawBody &&
        parseResult.data.is_available !== undefined
      ) {
        updateData.is_available = parseResult.data.is_available;
      }
      if ("sort_order" in rawBody && parseResult.data.sort_order !== undefined) {
        updateData.sort_order = parseResult.data.sort_order;
      }
    }
  }

  try {
    const supabase = await createServerSupabaseClient();

    let oldImagePath: string | null = null;
    if ("image_path" in rawBody) {
      const { data: currentItem, error: fetchErr } = await supabase
        .from("menu_items")
        .select("image_path")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchErr) {
        if (fetchErr.code === "42501") {
          return NextResponse.json(
            { error: "Akun ini tidak memiliki hak akses pemilik." },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      if (!currentItem) {
        return NextResponse.json(
          { error: "Menu tidak ditemukan." },
          { status: 404 }
        );
      }

      oldImagePath = currentItem.image_path ?? null;
    }

    // Jika category_id diubah dan sort_order tidak ditentukan secara eksplisit di request,
    // tempatkan menu di akhir daftar kategori tujuan (max(sort_order) + 1)
    if (updateData.category_id && !("sort_order" in rawBody)) {
      const { data: currentItem, error: fetchErr } = await supabase
        .from("menu_items")
        .select("category_id")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();

      if (fetchErr) {
        if (fetchErr.code === "42501") {
          return NextResponse.json(
            { error: "Akun ini tidak memiliki hak akses pemilik." },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      if (!currentItem) {
        return NextResponse.json(
          { error: "Menu tidak ditemukan." },
          { status: 404 }
        );
      }

      if (updateData.category_id !== currentItem.category_id) {
        // shortcut: penentuan max(sort_order) + 1 di server memadai untuk 1 akun pemilik (v1).
        // Upgrade ke RPC/transaksi database jika warung mendukung multi-admin konkuren di masa depan.
        const { data: maxItem, error: maxErr } = await supabase
          .from("menu_items")
          .select("sort_order")
          .eq("category_id", updateData.category_id)
          .eq("is_active", true)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (maxErr) {
          if (maxErr.code === "42501") {
            return NextResponse.json(
              { error: "Akun ini tidak memiliki hak akses pemilik." },
              { status: 403 }
            );
          }
          return NextResponse.json({ error: maxErr.message }, { status: 500 });
        }

        updateData.sort_order =
          maxItem?.sort_order !== undefined ? maxItem.sort_order + 1 : 0;
      }
    }

    let data: unknown;

    if (optionGroupsData !== undefined) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc(
        "save_menu_item_with_options",
        {
          p_menu_id: id,
          p_item: updateData,
          p_groups: optionGroupsData,
        }
      );

      if (rpcErr) {
        if (rpcErr.code === "42501") {
          return NextResponse.json(
            { error: "Akun ini tidak memiliki hak akses pemilik." },
            { status: 403 }
          );
        }
        if (rpcErr.code === "P0002") {
          return NextResponse.json(
            { error: "Menu tidak ditemukan." },
            { status: 404 }
          );
        }
        if (
          rpcErr.code === "22023" ||
          rpcErr.code === "P0001" ||
          rpcErr.code === "23503" ||
          rpcErr.code === "23514"
        ) {
          return NextResponse.json({ error: rpcErr.message }, { status: 400 });
        }
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      data = rpcData;
    } else {
      const { data: updatedItem, error } = await supabase
        .from("menu_items")
        .update(updateData)
        .eq("id", id)
        .eq("is_active", true)
        .select("*, category:categories(id, name)")
        .maybeSingle();

      if (error) {
        if (error.code === "42501") {
          return NextResponse.json(
            { error: "Akun ini tidak memiliki hak akses pemilik." },
            { status: 403 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!updatedItem) {
        return NextResponse.json(
          { error: "Menu tidak ditemukan." },
          { status: 404 }
        );
      }

      data = updatedItem;
    }

    if (oldImagePath && oldImagePath !== updateData.image_path) {
      try {
        // Pastikan foto lama tidak lagi direferensikan oleh menu lain sebelum dihapus dari storage
        const { count: remainingCount, error: countErr } = await supabase
          .from("menu_items")
          .select("id", { count: "exact", head: true })
          .eq("image_path", oldImagePath);

        if (!countErr && (remainingCount ?? 0) === 0) {
          const { error: storageErr } = await supabase.storage
            .from(MENU_PHOTOS_BUCKET)
            .remove([oldImagePath]);
          if (storageErr) {
            console.error("Gagal menghapus foto lama dari storage:", storageErr);
          }
        }
      } catch (err) {
        console.error("Gagal menghapus foto lama dari storage:", err);
      }
    }

    revalidatePath("/");
    revalidatePath("/admin/menu");

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Akses ditolak. Sesi pemilik diperlukan." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: "ID menu tidak valid." },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    // HAPUS LUNAK: update is_active = false agar riwayat pesanan (order_items) tetap utuh
    const { data, error } = await supabase
      .from("menu_items")
      .update({ is_active: false })
      .eq("id", id)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json(
          { error: "Akun ini tidak memiliki hak akses pemilik." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Menu tidak ditemukan." },
        { status: 404 }
      );
    }

    revalidatePath("/");
    revalidatePath("/admin/menu");

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
