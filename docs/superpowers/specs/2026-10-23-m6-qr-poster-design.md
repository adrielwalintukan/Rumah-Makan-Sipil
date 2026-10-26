# Desain Teknis: Poster QR Cetak & Unduh PNG (Issue #23)

**Tanggal:** 23 Oktober 2026  
**Milestone:** M6 - Poster QR, Polish, Rilis  
**Issue Terkait:** #23 ([M6] Poster QR: cetak (A4/A5) + unduh PNG)  
**Dokumen Acuan:** `docs/PRD.md §4.2 (D10) & §5 (US-16)` · `docs/user-flows.md §5` · `docs/architecture.md §1, §3, §4 & §9` · `docs/design-system.md`  

---

## 1. Tujuan & Lingkup

Menyediakan halaman terproteksi `/admin/qr` bagi pemilik warung Rumah Makan Sipil untuk melihat pratinjau, mencetak langsung, dan mengunduh file poster QR siap cetak berkualitas tinggi (A4 dan A5) tanpa perlu mendesain manual di aplikasi luar.

### Lingkup Fitur (In-Scope)

1. **Instalasi Dependensi Standar**:
   - Paket `qrcode` (runtime) dan `@types/qrcode` (devDependency) sesuai spesifikasi `architecture.md §1`.
2. **Modul Utilitas QR & Canvas (`lib/qr.ts`)**:
   - Resolusi URL kanonikal toko dari `NEXT_PUBLIC_SITE_URL` dengan fallback aman.
   - Pembangkitan data URL gambar QR code resolusi tinggi (error correction level M atau Q).
   - Perenderan poster ke HTML Canvas offscreen resolusi cetak (300 DPI) untuk ekspor PNG tajam.
   - Pemicu unduh file PNG otomatis di browser (`poster-rumah-makan-sipil-[a4|a5].png`).
3. **Antarmuka Pratinjau Interaktif (`components/admin/qr/`)**:
   - Toggle ukuran: **A4** (210 x 297 mm untuk dinding / kasir) dan **A5** (148 x 210 mm untuk tenda meja makan).
   - Tampilan visual poster bermerek yang hangat dan proporsional (rasio ISO 216 1 : 1.414):
     - Emblem monogram RMS dan nama toko (`store_name`, font display Fraunces).
     - Tagline toko (`tagline`).
     - Kartu QR code kontras tinggi berbingkai bersih.
     - Badge ajakan: "Scan untuk Pesan".
     - Panduan 3 langkah mudah bagi pelanggan:
       1. Buka kamera / scan QR.
       2. Pilih menu makanan & minuman favorit.
       3. Bayar di kasir / QRIS DANA & makanan diantar.
     - Teks alamat web pemesanan di bagian bawah kartu.
   - Tombol aksi utama:
     - **Cetak Poster**: memicu dialog cetak browser (`window.print()`).
     - **Unduh PNG**: menghasilkan file gambar 300 DPI siap cetak.
4. **Isolasi Tata Letak Cetak (`@media print`)**:
   - Menyembunyikan seluruh elemen navigasi admin (`AdminNav`, sidebar, header mobile, tab bar, tombol kontrol).
   - Memastikan area poster tercetak pas 1 halaman penuh tanpa terpotong ke halaman berikutnya.
   - Mengaktifkan `-webkit-print-color-adjust: exact; print-color-adjust: exact;` agar border dan latar belakang brand tetap tercetak.
5. **Integrasi Halaman Server (`app/admin/(dashboard)/qr/page.tsx`)**:
   - Proteksi sesi pemilik via `getAdminUser()`.
   - Mengambil data nama dan tagline toko dari tabel database `settings`.
   - Menghasilkan QR code data URL di sisi server untuk pratinjau instan bebas flickering.
6. **Pengujian Menyeluruh**:
   - Unit test Vitest untuk helper `lib/qr.ts` dan komponen pratinjau poster.
   - E2E Playwright test untuk verifikasi alur halaman `/admin/qr`.

### Di Luar Lingkup (Strictly Out-of-Scope)

1. QR unik per nomor meja (meja 1, meja 2, dst) - Sesuai PRD §4.1 P1, v1 menggunakan satu QR universal untuk seluruh meja dan kasir.
2. Pengaturan custom domain mandiri (Issue #34 - Fase berikutnya).
3. Integrasi printer thermal Bluetooth / cetak struk kasir 58mm/80mm (Issue #28 - Fase berikutnya).
4. Editor poster WYSIWYG bebas - Format poster terstandarisasi sesuai panduan visual brand resmi warung.

---

## 2. Arsitektur Komponen & Data

```
app/admin/(dashboard)/qr/page.tsx (Server Component)
  ├── getAdminUser() -> guard sesi admin
  ├── supabase.from("settings").select("store_name, tagline").single()
  ├── getStoreCanonicalUrl() -> URL pemesanan kanonikal
  ├── generateQrDataUrl(targetUrl) -> Server-side initial QR
  └── <QrPosterDashboard> (Client Component)
        ├── Toolbar Kontrol (Ukuran A4/A5, Tombol Cetak, Tombol Unduh PNG)
        └── <PosterCard> (Elemen Cetak & Pratinjau Interaktif)
              ├── Header: Emblem RMS + Nama Toko + Tagline
              ├── Tengah: Badge Ajakan + QR Code Image + Frame Dekoratif
              ├── Instruksi: 3 Langkah Pemesanan Meja
              └── Footer: URL Web Toko
```

---

## 3. Spesifikasi Teknis Poster & Resolusi Cetak

### A. Dimensi Rasio ISO 216
- **A4**: 210 x 297 mm (Rasio 1 : 1.414). Pada 300 DPI = **2480 x 3508 piksel**.
- **A5**: 148 x 210 mm (Rasio 1 : 1.414). Pada 300 DPI = **1748 x 2480 piksel**.

### B. Desain Visual Poster (Design System Tokens)
- **Latar Belakang**: `bg-cream-50` (`#FBF8F2`) dengan tekstur bersih.
- **Border Dekoratif**: Double border tipis dengan warna `green-900` (`#1F3D2B`) dan aksen emas/coklat `brown-500` (`#A86A32`).
- **Header**:
  - Monogram RMS dalam badge bulat/persegi tumpul `bg-green-700` teks putih.
  - Nama toko dalam font Fraunces bold (`text-green-900`).
  - Tagline dalam font Plus Jakarta Sans medium (`text-ink-600`).
- **Kotak QR Code**:
  - Kontainer putih bersih ber-border lembut.
  - Gambar QR resolusi tinggi (`ink-900` di atas putih, quiet zone 2 modul).
  - Badge hijau di atas QR: "SCAN UNTUK PESAN".
- **Panduan 3 Langkah**:
  - Disajikan dalam 3 kartu mini horizontal/vertikal:
    1. Ikon Kamera / Scan: "Buka Kamera HP & Arahkan ke QR"
    2. Ikon Menu / Garpu: "Pilih Makanan & Minuman Favorit"
    3. Ikon Kasir / Centang: "Bayar di Kasir/QRIS, Makanan Diantar"
- **Footer**:
  - Teks URL: "Atau buka di browser: `[URL_TOKO]`"

---

## 4. Rencana File & Modul

1. `package.json`:
   - Tambah `"qrcode": "^1.5.4"` di dependencies.
   - Tambah `"@types/qrcode": "^1.5.5"` di devDependencies.
2. `lib/qr.ts` & `lib/qr.test.ts`:
   - Utilitas `getStoreCanonicalUrl()`.
   - Utilitas `generateQrDataUrl()`.
   - Utilitas `exportPosterToPngBlob()`.
3. `components/admin/qr/poster-card.tsx`:
   - Komponen visual poster dengan prop `size: "a4" | "a5"`, `storeName`, `tagline`, `qrDataUrl`, `siteUrl`.
4. `components/admin/qr/qr-poster-dashboard.tsx`:
   - Komponen interaktif dengan state `selectedSize`, tombol Cetak, tombol Unduh, dan status loading saat generate blob.
5. `components/admin/qr/poster-components.test.tsx`:
   - Pengujian interaksi komponen poster.
6. `app/admin/(dashboard)/qr/page.tsx`:
   - Server Component PPR yang memuat data settings dan merender `QrPosterDashboard`.
7. `e2e/admin-qr.spec.ts`:
   - Pengujian alur E2E halaman poster QR.
8. `docs/roadmap.md`:
   - Sinkronisasi checklist M6.
