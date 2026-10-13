# Data Menu Awal

Sumber: banner menu Rumah Makan Sipil. Data ini menjadi `supabase/seed.sql`. Semua isi bisa diubah pemilik dari dashboard (**Kelola menu**).

Dokumen terkait: [PRD](PRD.md) · [Arsitektur](architecture.md)

---

## Kategori

| Urutan | Kategori | Ikon |
|---|---|---|
| 1 | Makanan | `utensils` |
| 2 | Minuman | `coffee` |

## Makanan

| Menu | Harga dasar | Grup pilihan | Opsi (tambahan harga) |
|---|---|---|---|
| Nasi Campur | Rp15.000 | – | – |
| Nasi Telur | Rp10.000 | – | – |
| Miedal/Tinutuan | Rp10.000 | – | – |
| Cotto Ayam | Rp15.000 | **Pilihan** (pilih satu, wajib) | Laksa, Mie, Nasi (+0) |
| Gorengan (isi 4) | Rp5.000 | – | – |
| Mie | Rp7.000 | **Jenis** (pilih satu, wajib) | Kuah, Goreng (+0) |
| | | **Tambahan** (boleh, tidak wajib) | Telur (+Rp3.000) |

> "Mie Kuah/Goreng + Telur 10rb" di banner = Mie 7rb + tambahan Telur 3rb.

## Minuman

| Menu | Harga dasar | Grup pilihan | Opsi (tambahan harga) |
|---|---|---|---|
| Teh Manis | Rp5.000 | **Penyajian** (pilih satu, wajib) | Panas, Dingin (+0) |
| Kopi | Rp5.000* | **Jenis** (pilih satu, wajib) | Golda, Good Day Cappuccino (+0)** |
| | | **Penyajian** (pilih satu, wajib) | Panas, Dingin (+0) |
| Susu | Rp7.000 | – | – |
| Soda | Rp7.000 | **Pilihan** (pilih satu, wajib) | Coca Cola, Fanta, Sprite (+0) |
| Aqua | Rp5.000 | – | – |

\* Harga kopi diasumsikan Rp5.000 (sama dengan "Minuman Panas/Dingin" di banner). Periksa dan ubah di dashboard bila berbeda.
\*\* Jenis kopi lain ditambahkan pemilik sebagai opsi baru di grup **Jenis**. Jika ada jenis yang harganya beda, isi tambahan harganya (mis. +Rp2.000).

## Paket Dos (bukan item keranjang)

| Item | Nilai |
|---|---|
| Harga | Rp25.000 / dos (`settings.dos_price`) |
| Pemesanan | Tombol WhatsApp ke **+62 895-8065-67230** (`settings.whatsapp_number` = `62895806567230`, format `wa.me` tanpa `+` dan spasi) |
| Pesan awal | `Halo Rumah Makan Sipil, saya mau pesan Paket Dos (Rp25.000/dos). Jumlah: … Tanggal: …` |

## Pengaturan awal toko

| Kolom | Nilai |
|---|---|
| `store_name` | Rumah Makan Sipil |
| `tagline` | Makan Enak, Setiap Hari |
| `is_open` | `false` (pemilik membuka toko dari dashboard) |
| `qris_image_path` | diupload pemilik (gambar QRIS DANA Bisnis) |
