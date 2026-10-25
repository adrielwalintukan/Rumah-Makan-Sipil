# User Flows — Rumah Makan Sipil

Dokumen terkait: [PRD](PRD.md) · [Design System](design-system.md) · [Arsitektur](architecture.md)

---

## 1. Alur pelanggan

```mermaid
flowchart TD
    A[Scan QR / buka link] --> B{Toko buka?}
    B -- Tidak --> B1[Lihat menu saja<br/>banner 'Sedang tutup']
    B -- Ya --> C[Halaman menu]
    C --> D{Menu punya pilihan?}
    D -- Ya --> E[Bottom sheet:<br/>pilih opsi + catatan + jumlah]
    D -- Tidak --> F[Tambah ke keranjang]
    E --> F
    F --> C
    C -- Paket Dos --> W[Buka WhatsApp<br/>pesan terisi otomatis]
    F --> G[Keranjang]
    G --> H[Checkout:<br/>Makan di sini / Bungkus<br/>Nama, No. HP opsional<br/>QRIS / Cash]
    H --> I{Server validasi:<br/>toko buka, menu tersedia,<br/>batas pesanan}
    I -- Gagal --> H1[Pesan error jelas<br/>keranjang tetap ada] --> G
    I -- OK --> J[Pesanan dibuat<br/>nomor antrean #xxx]
    J --> K{Metode bayar}
    K -- QRIS --> L[Tampil QRIS + total besar]
    L --> M[Tekan 'Saya sudah bayar']
    M --> N[Halaman lacak pesanan]
    K -- Cash --> N1[Instruksi: bayar di kasir<br/>sebut nama + #xxx] --> N
    N --> O[Status update otomatis<br/>Baru → Dimasak → Siap]
    O --> P[Siap: getar + 'Silakan ambil']
```

## 2. Alur pemilik

```mermaid
flowchart TD
    A[Login] --> B[Dashboard Pesanan]
    B --> B0[Ketuk 'Aktifkan suara' sekali]
    B --> T[Toggle Buka / Tutup toko]
    B0 --> C((Pesanan baru masuk<br/>bunyi + kartu baru))
    C --> D[Baca item & catatan]
    D --> E[Mulai masak]
    E --> F[Siap → pelanggan diberi tahu]
    F --> G[Panggil nama + nomor]
    G --> H{Sudah lunas?}
    H -- Belum, Cash --> I[Terima uang → Lunas]
    H -- Belum, QRIS --> J[Cek notifikasi DANA<br/>nominal cocok → Lunas]
    H -- Sudah --> K[Selesai]
    I --> K
    J --> K
    D -. bahan habis / iseng .-> X[Batal + alasan]
```

Catatan: tombol **Lunas** bisa ditekan kapan saja (sebelum, saat, atau sesudah memasak). Urutan di diagram hanya urutan yang paling umum.

## 3. Status pesanan (masak)

```mermaid
stateDiagram-v2
    [*] --> baru
    baru --> dimasak: Mulai masak
    dimasak --> siap: Siap
    siap --> selesai: Selesai
    baru --> batal: Batal
    dimasak --> batal: Batal
    siap --> batal: Batal
    selesai --> [*]
    batal --> [*]
```

## 4. Status bayar

```mermaid
stateDiagram-v2
    [*] --> belum_bayar
    belum_bayar --> menunggu_verifikasi: Pelanggan tekan 'Saya sudah bayar' (QRIS)
    belum_bayar --> lunas: Pemilik tandai Lunas
    menunggu_verifikasi --> lunas: Pemilik cek DANA → Lunas
    menunggu_verifikasi --> belum_bayar: Pemilik: 'Pembayaran belum masuk'
    lunas --> [*]
```

## 5. Daftar layar

### Pelanggan (rute publik)

| Rute | Layar | Isi utama |
|---|---|---|
| `/` | Menu | Header (logo, tagline, status buka/tutup), banner geser (Paket Dos, cara pesan, cara bayar), tab kategori, kartu menu, bar keranjang |
| (sheet) | Detail/pilihan menu | Opsi, catatan, jumlah, tombol Tambah |
| `/keranjang` | Keranjang | Daftar item, ubah jumlah, total, tombol Lanjut |
| `/checkout` | Checkout | Jenis pesanan, nama, no. HP, metode bayar, ringkasan, tombol Pesan Sekarang |
| `/pesanan/[token]` | Lacak pesanan | Nomor antrean besar, status masak & bayar, item, total, QRIS (jika belum bayar & QRIS), tombol "Saya sudah bayar" |

### Pemilik (rute `/admin`, wajib login)

| Rute | Layar | Isi utama |
|---|---|---|
| `/admin/login` | Login | Email, password |
| `/admin` | Pesanan live | Toggle buka/tutup, tombol suara, filter/kanban Baru · Dimasak · Siap, kartu pesanan |
| `/admin/menu` | Kelola menu | Daftar per kategori, toggle Habis, urutkan, tambah menu |
| `/admin/menu/[id]` | Form menu | Nama, kategori, harga, deskripsi, foto, grup pilihan & opsi |
| `/admin/riwayat` | Riwayat | Filter tanggal, daftar pesanan, detail |
| `/admin/laporan` | Laporan | Kartu statistik hari ini/bulan ini, menu terlaris, Cash vs QRIS |
| `/admin/keuangan` | Catatan keuangan | Buku kas per tanggal (pemasukan, pengeluaran, laba kotor), tambah pengeluaran |
| `/admin/qr` | Poster QR | Pratinjau poster, Cetak, Unduh PNG |
| `/admin/pengaturan` | Pengaturan | Nama & tagline, gambar QRIS, nomor WhatsApp, harga Paket Dos, ganti password |

## 6. Kasus khusus

| Situasi | Perilaku |
|---|---|
| Menu habis saat pelanggan sedang checkout | Server menolak, menandai item yang habis di keranjang, dan pelanggan bisa menghapusnya lalu mengirim ulang |
| Toko ditutup saat pelanggan checkout | Server menolak dengan pesan "Maaf, toko baru saja tutup" |
| Pelanggan menutup browser | Link lacak tersimpan di `localStorage`, dan halaman menu menampilkan banner "Pesanan aktif kamu #007 →" |
| Pelanggan menekan Pesan dua kali | Tombol nonaktif saat mengirim, dan server memakai *idempotency key* agar tidak terbuat pesanan ganda |
| Batas pesanan terlampaui | Pesan "Terlalu banyak pesanan dari perangkat ini, coba lagi beberapa menit lagi" |
| Dashboard kehilangan koneksi | Banner "Koneksi terputus, mencoba menyambung…", lalu data dimuat ulang otomatis setelah tersambung |
| Pesanan dibatalkan | Halaman lacak pelanggan menampilkan "Pesanan dibatalkan" + alasan (jika ada) |
