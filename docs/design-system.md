# Design System — Rumah Makan Sipil

Arah desain: **clean, modern, hangat, mudah dipakai dengan satu tangan.** Identitas diambil dari banner menu: hijau tua, coklat, krem, judul serif tebal, dan tagline "Makan Enak, Setiap Hari".

Dokumen terkait: [PRD](PRD.md) · [User Flows](user-flows.md)

---

## 1. Prinsip

1. **Mobile-first.** Rancang untuk lebar 360–430 px, lalu lebarkan untuk tablet/desktop.
2. **Satu aksi utama per layar.** Tombol utama selalu besar, hijau, dan mudah dijangkau jempol (bagian bawah layar).
3. **Status harus terbaca sekilas.** Warna + ikon + teks, jangan hanya warna.
4. **Hangat, bukan ramai.** Banyak ruang kosong krem, aksen coklat secukupnya.
5. **Foto opsional.** Semua komponen harus tetap rapi dengan atau tanpa foto.

## 2. Warna

Diambil dari banner. Tulis sebagai CSS variable / token Tailwind.

### 2.1 Brand

| Token | Hex | Pemakaian |
|---|---|---|
| `green-900` | `#1F3D2B` | Teks judul, header gelap |
| `green-700` (**primary**) | `#2E5A3F` | Tombol utama, tab aktif, link |
| `green-600` | `#3A6E4E` | Hover/pressed primary |
| `green-100` | `#E3EDE5` | Latar badge hijau, highlight lembut |
| `green-200` | `#C7DED0` | Border hijau lembut |
| `green-50` | `#F2F7F3` | Latar banner hijau sangat lembut |
| `brown-700` | `#7A4E24` | Teks aksen, harga |
| `brown-500` (**accent**) | `#A86A32` | Ikon kategori, badge aksen, garis dekoratif |
| `brown-100` | `#F1E3D3` | Latar kartu aksen (Paket Dos) |
| `cream-50` (**background**) | `#FBF8F2` | Latar halaman |
| `cream-100` | `#F4EEE3` | Latar section, placeholder foto |
| `cream-200` | `#E9E0CF` | Skeleton di atas `cream-100`, hover chip krem |
| `white` (**surface**) | `#FFFFFF` | Kartu, sheet, input |

### 2.2 Netral

| Token | Hex | Pemakaian |
|---|---|---|
| `ink-900` | `#1C1B18` | Teks utama |
| `ink-600` | `#5C5A54` | Teks sekunder |
| `ink-400` | `#9A978F` | Placeholder, teks nonaktif |
| `line` | `#E7E1D6` | Garis pemisah, border kartu |

### 2.3 Status

| Token | Hex (teks / latar) | Arti |
|---|---|---|
| `info` | `#1E5AA8` / `#E4EEFB` | **Baru** |
| `warning` | `#A15C00` / `#FDF0D9` | **Dimasak**, **Menunggu verifikasi** |
| `success` | `#1F7A45` / `#E2F3E8` | **Siap**, **Lunas** |
| `danger` | `#B42318` / `#FDE7E5` | **Belum bayar**, **Batal**, error |
| `muted` | `#5C5A54` / `#EEEBE5` | **Selesai**, **Habis** |

Semua pasangan teks/latar di atas memenuhi kontras **WCAG AA (≥ 4.5:1)**. Jika mengubah warna, cek ulang kontrasnya.

## 3. Tipografi

| Peran | Font | Catatan |
|---|---|---|
| Display / judul | **Fraunces** (Google Fonts), 700–800 | Serif tebal seperti logo "SIPIL". Hanya untuk nama toko, judul halaman, dan nomor antrean |
| Teks & UI | **Plus Jakarta Sans** (Google Fonts), 400/500/600/700 | Bersih, modern, buatan Indonesia |
| Angka (harga, total) | Plus Jakarta Sans + `font-variant-numeric: tabular-nums` | Angka rata agar mudah dibandingkan |

Skala (mobile → desktop):

| Token | Ukuran / line-height | Pemakaian |
|---|---|---|
| `display` | 40/44 → 48/52 | Nomor antrean (#007) |
| `h1` | 28/34 → 32/38 | Judul halaman |
| `h2` | 22/28 | Judul section/kategori |
| `h3` | 18/24, 600 | Nama menu, judul kartu |
| `body` | 16/24 | Teks umum (**jangan di bawah 16 px pada input** agar iOS tidak zoom) |
| `small` | 14/20 | Deskripsi, meta |
| `caption` | 12/16, 500 | Badge, label |

Format harga: **`Rp15.000`** (titik ribuan, tanpa desimal). Pada daftar menu yang padat boleh memakai `15rb`, tetapi di checkout & struk selalu pakai format lengkap.

## 4. Spacing, radius, bayangan

- **Spacing** kelipatan 4 px: `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- **Gutter halaman**: 16 px (mobile), 24 px (tablet), 32 px (desktop).
- **Radius**: `sm 8px` (badge, input), `md 12px` (tombol), `lg 16px` (kartu), `xl 24px` (bottom sheet atas), `full` (chip, avatar).
- **Bayangan**: `card: 0 1px 2px rgb(31 61 43 / 0.06), 0 2px 8px rgb(31 61 43 / 0.06)` dan `sheet: 0 -8px 24px rgb(31 61 43 / 0.12)`. Bayangan tipis saja, karena border `line` sudah cukup memisahkan.

## 5. Ikon & ilustrasi

- Ikon: **Lucide** (sudah dipakai shadcn/ui), stroke 2, ukuran 20/24 px.
- Ikon kategori (Makanan = sendok-garpu, Minuman = cangkir) dalam lingkaran `brown-500`, seperti di banner.
- **Placeholder foto menu**: latar `cream-100`, ikon kategori `brown-500` 40% opacity di tengah, dan inisial nama menu dalam Fraunces. Placeholder ini terlihat disengaja, bukan "gambar rusak".

## 6. Komponen

### 6.1 Tombol

| Varian | Tampilan | Pemakaian |
|---|---|---|
| Primary | Latar `green-700`, teks putih | Aksi utama (Tambah, Pesan Sekarang, Mulai masak) |
| Secondary | Border `green-700`, teks `green-700`, latar putih | Aksi kedua (Lihat QRIS, Riwayat) |
| Accent | Latar `brown-700`, teks putih | **Lunas**, Pesan via WhatsApp |
| Ghost | Tanpa latar, teks `ink-600` | Batal kecil, tutup |
| Danger | Teks/border `danger` | Batal pesanan, hapus |

Teks putih di atas `brown-500` hanya ±4,4:1 (gagal AA), jadi tombol Accent memakai `brown-700` (±7:1); `brown-500` tetap untuk ikon & dekorasi.

Tinggi minimal **48 px** (mobile) dan target sentuh ≥ **44×44 px**. State: hover, pressed (sedikit lebih gelap + `scale(0.98)`), disabled (opacity 40%), loading (spinner + label tetap).

### 6.2 Kartu menu (pelanggan)

Dua tata letak dengan ukuran yang **sama**, sehingga daftar tetap rapi walau hanya sebagian menu punya foto:

```
┌───────────────────────────────────────────┐
│ ┌────────┐  Cotto Ayam                    │
│ │  foto  │  Laksa / Mie / Nasi            │
│ │  4:3   │                                │
│ └────────┘  Rp15.000              [ + ]   │
└───────────────────────────────────────────┘
```

- Foto/placeholder di kiri, **96×72 px** (rasio 4:3, `object-fit: cover`, radius `sm`). Ukuran dikunci agar foto apa pun yang diupload tetap rapi.
- Kanan: nama (`h3`, maks. 2 baris), ringkasan pilihan/deskripsi (`small`, `ink-600`, 1 baris + elipsis), dan harga (`brown-700`, 600).
- Tombol `+` bulat 40 px `green-700` di kanan bawah. Jika item sudah di keranjang, berubah menjadi stepper `– 2 +`.
- **Habis**: kartu opacity 50%, badge `muted` "Habis", tombol hilang.
- Tablet/desktop: kartu menjadi grid 2 kolom dengan tata letak **tetap horizontal** (foto kiri 112×84 px). Foto penuh lebar ditinggalkan karena placeholder raksasa mendominasi halaman saat sebagian besar menu belum berfoto.

### 6.3 Bottom sheet pilihan menu

- Muncul dari bawah (radius atas `xl`), tinggi maks. 90% layar, ada *handle* di atas.
- Isi: foto besar (jika ada), nama, harga dasar, grup pilihan (radio untuk *pilih satu*, checkbox untuk *tambahan*), label "Wajib" pada grup wajib, textarea catatan, stepper jumlah.
- Tombol sticky di bawah: **"Tambah · Rp18.000"** (harga ikut berubah).

### 6.4 Keranjang sticky

- Bar mengambang di bawah layar saat keranjang tidak kosong: `green-700`, "**3 item** · Rp32.000 · Lihat keranjang →".
- Memperhitungkan *safe area* iPhone (`env(safe-area-inset-bottom)`).

### 6.5 Badge status

Bentuk *pill* (radius full), ikon kecil + teks `caption`, dengan warna sesuai §2.3.

| Status masak | Ikon | | Status bayar | Ikon |
|---|---|---|---|---|
| Baru | `bell` | | Belum bayar | `circle-alert` |
| Dimasak | `flame` | | Menunggu verifikasi | `clock` |
| Siap | `check-circle` | | Lunas | `badge-check` |
| Selesai | `check` | | | |
| Batal | `x-circle` | | | |

### 6.6 Kartu pesanan (dashboard)

```
┌───────────────────────────────────────────┐
│ #007  Budi              🍽 Makan di sini   │
│ 12:41 · 3 menit lalu                      │
│───────────────────────────────────────────│
│ 2× Mie (Goreng, + Telur)                  │
│    “tidak pedas”                          │
│ 1× Teh Manis (Dingin)                     │
│───────────────────────────────────────────│
│ Rp25.000   [QRIS · Menunggu verifikasi]   │
│ [  Lunas  ]        [  Mulai masak  →  ]   │
└───────────────────────────────────────────┘
```

- Nomor antrean memakai Fraunces 28 px. Catatan pelanggan ditulis miring dengan latar `brown-100` agar tidak terlewat.
- Garis kiri 4 px berwarna status bayar (merah = belum bayar, kuning = menunggu verifikasi, hijau = lunas).
- Pesanan baru: animasi *pulse* singkat + bunyi.
- Tombol aksi: aksi masak utama (Mulai masak → Siap → Selesai) **penuh lebar, tinggi 48 px** di baris paling bawah (zona jempol). Aksi bayar/batal ada di baris atasnya, tinggi 44 px. Tombol ini dipakai di dapur, jadi jangan dikecilkan.

### 6.7 Input & form

- Tinggi 48 px, radius `sm`, border `line`. Fokus: border `green-700` + ring 3 px `green-100`.
- Label di atas input (bukan placeholder saja). Pesan error di bawah, warna `danger`, disertai ikon.
- Pilihan Makan di sini/Bungkus dan QRIS/Cash memakai **kartu pilihan besar** (segmented card) dengan ikon, bukan dropdown.

### 6.8 Lain-lain

- **Hero toko** (menu pelanggan, gaya aplikasi franchise): blok `green-900` (sudut bawah membulat di HP, kartu `radius-2xl` di desktop) dengan pola titik halus dan cahaya *blur* `green-600`/`brown-500`. Kiri: pill status Buka (titik berdenyut)/Tutup, "RUMAH MAKAN" + **SIPIL** besar (Fraunces, `cream-50`), dan tagline `brown-100`. Kanan: ilustrasi SVG **sepiring nasi campur** beralas daun (ayam goreng, telur ceplok, sambal, timun) di atas lingkaran "piring" yang melayang perlahan, dengan uap naik dan cabai/daun/kilau yang bergoyang. Bawah: chip layanan (Makan di sini, Bungkus, Pesan dari HP). Tanpa emblem/nama ganda, dan tanpa rating/jam buka/lokasi karangan.
- **Banner geser** (di bawah hero): carousel *scroll-snap* tanpa library. Slide `radius-2xl`, min. 176 px, **satu banner penuh selebar konten** di semua layar, bisa digeser. Urutan: dulu **menu unggulan** pilihan pemilik (D12; `green-900`, pill ⭐ "Menu unggulan", foto/placeholder menu setinggi banner di sisi kanan (60% di HP, 50% di ≥ 640 px, 38% di ≥ 1024 px) dengan tepi kiri memudar bertahap (`mask-image` beberapa titik) agar foto apa pun menyatu dengan latar banner, nama, harga, tombol **Tambah** atau **Pilih** dengan logika yang sama seperti kartu menu; Habis disembunyikan, dan tanpa tombol saat toko tutup), lalu info yang sudah ada: **Paket Dos** (`brown-700`, tombol WhatsApp, P9), **Pesan dari HP** (`green-700`, tombol "Lihat menu"), dan **QRIS atau tunai** (`cream-100`); promo/diskon menunggu fase berikutnya. Tiap slide info punya **ilustrasi SVG inline besar** di sisi kanan (±40% lebar, di atas lingkaran sorot transparan); teks dibatasi 58% lebar di kiri (kotak nasi, HP dengan notifikasi "Siap!", kartu QR + uang), pola titik halus, dan cahaya lembut. Tombol WhatsApp memakai **logo WhatsApp asli** di lingkaran `#25D366`; hijau ini satu-satunya warna di luar token dan hanya untuk logo pihak ketiga. Indikator titik (target 44 px), panah di ≥ 640 px (berputar dari slide terakhir ke pertama), **Geser otomatis tiap 4,5 detik** dengan transisi *smooth scroll* cepat. Berhenti sementara saat di-hover, **berhenti permanen** begitu banner disentuh, digeser, atau difokus, dan tidak otomatis sama sekali bila `prefers-reduced-motion`. Tanpa tombol jeda atas permintaan pemilik; WCAG 2.2.2 menyarankan tombol jeda, jadi tambahkan bila ada keluhan.
- **Tab kategori**: chip horizontal yang bisa digeser dan *sticky* di bawah header. Chip aktif `green-700`.
- **Kartu statistik** (laporan): label `small` + angka besar `h1` tabular, dan perbandingan kecil (mis. "vs kemarin").
- **Empty state**: ilustrasi ikon sederhana + kalimat ramah ("Belum ada pesanan. Santai dulu ☕").
- **Toast**: muncul di atas, hilang otomatis setelah 3 detik.
- **Skeleton loading** berwarna `cream-100` (atau `cream-200` bila di atas permukaan `cream-100`) untuk daftar menu & pesanan.

## 7. Layout & breakpoint

| Breakpoint | Lebar | Pelanggan | Dashboard |
|---|---|---|---|
| Mobile | < 640 px | 1 kolom, keranjang sticky bawah | Navigasi **bottom tab** (Pesanan, Menu, Keuangan, Lainnya), pesanan 1 kolom dengan filter status |
| Tablet | 640–1023 px | Grid menu 2 kolom | Pesanan **kanban 2–3 kolom** (Baru / Dimasak / Siap) |
| Desktop | ≥ 1024 px | Konten maks. 720 px di tengah, keranjang sebagai panel kanan | Sidebar kiri + kanban 3 kolom + panel detail |

## 8. Gerak (motion)

- Durasi 150–250 ms, easing `ease-out`.
- Bottom sheet slide-up 250 ms, dan item yang ditambah ke keranjang memicu *bounce* kecil pada bar keranjang.
- Ilustrasi hero & banner memakai animasi dekoratif berulang yang lambat: `animate-float` (melayang 6 px, 4 dtk), `animate-drift` (bergoyang + rotasi kecil, 6 dtk), `animate-steam` (uap naik & memudar, 2,4 dtk). Token-nya ada di `app/globals.css`.
- Hormati `prefers-reduced-motion`: matikan animasi non-esensial. Elemen beranimasi diberi `motion-reduce:animate-none` agar tetap tampil statis (uap tetap terlihat).

## 9. Aksesibilitas

- Kontras teks ≥ 4.5:1, target sentuh ≥ 44 px, dan fokus keyboard selalu terlihat.
- Semua ikon-saja punya `aria-label`. Status tidak hanya dibedakan lewat warna.
- Perubahan status di halaman lacak diumumkan dengan `aria-live="polite"`.
- `lang="id"` di root dokumen.

## 10. Gaya bahasa (copy)

- Bahasa Indonesia santai dan sopan, memakai "kamu" untuk pelanggan.
- Singkat dan jelas: "Pesan Sekarang", "Saya sudah bayar", "Pesanan kamu siap! Silakan ambil di kasir."
- Hindari istilah teknis ("Gagal memuat data, coba lagi" — bukan "Error 500").

## 11. Implementasi (Tailwind + shadcn/ui)

- Token warna ada di `app/globals.css` (Tailwind v4 `@theme`, tanpa `tailwind.config`): kelas memakai nama token dokumen ini (`bg-green-700`, `text-brown-700`, `bg-cream-50`, `bg-danger-bg`, …), dan palet `green` bawaan Tailwind dinonaktifkan agar tidak tercampur. **Hanya pakai token yang tercantum di dokumen ini.** Langkah yang tidak ada (mis. `ink-700`, `green-300`, `brown-50`) tidak menghasilkan style apa pun, dan palet bawaan Tailwind (`amber-*`, `red-*`, …) tidak dipakai; gunakan token status `warning` / `danger`.
- Variabel shadcn dipetakan ke token brand: `--primary` = `green-700`, `--background` = `cream-50`, `--border` = `line`. `--accent` shadcn adalah latar *hover* (`green-100`), **bukan** warna aksen coklat. Untuk coklat, pakai kelas `brown-*` atau varian tombol `accent`.
- Font dimuat via `next/font/google` (Fraunces, Plus Jakarta Sans) dengan `display: swap`.
- v1 hanya memakai **tema terang** (warung, layar di bawah cahaya). Tema gelap bisa ditambahkan nanti lewat token yang sama.
