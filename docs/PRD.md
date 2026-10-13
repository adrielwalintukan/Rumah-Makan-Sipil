# PRD — Rumah Makan Sipil: Pesan dari HP

| | |
|---|---|
| Versi | 1.0 (v1 / MVP) |
| Tanggal | 14 Oktober 2026 |
| Pemilik produk | Adriel Walintukan |
| Status | Disetujui untuk dikerjakan |

Dokumen terkait: [Design System](design-system.md) · [User Flows](user-flows.md) · [Arsitektur](architecture.md) · [Roadmap](roadmap.md) · [Data Menu Awal](menu-seed.md)

---

## 1. Latar belakang

Rumah Makan Sipil adalah warung makan kecil (10–20 meja) dengan **satu orang** yang memasak sekaligus menjadi kasir. Saat ini pelanggan memesan secara lisan. Akibatnya:

- Penjual harus bolak-balik antara dapur dan meja untuk mencatat pesanan.
- Pesanan mudah tertukar atau terlupa saat ramai.
- Pembayaran QRIS (DANA Bisnis) sudah ada, tetapi pencatatan pemasukan masih manual.
- Tidak ada catatan omzet dan pengeluaran yang rapi.

## 2. Tujuan

| Tujuan | Ukuran keberhasilan |
|---|---|
| Pelanggan bisa memesan sendiri dari HP | ≥ 70% pesanan masuk lewat aplikasi setelah 1 bulan |
| Pesanan cepat dan mudah dibuat | Dari scan QR sampai pesanan terkirim < 2 menit |
| Penjual tidak perlu mencatat manual | Semua pesanan tercatat otomatis, termasuk status bayar |
| Keuangan harian terlihat jelas | Penjual bisa melihat omzet, pengeluaran, dan laba kotor hari ini dalam 1 layar |

## 3. Pengguna

**Pelanggan**: datang ke warung atau ingin membungkus. Memakai HP Android/iPhone dengan berbagai ukuran layar dan koneksi yang kadang lambat. Tidak mau daftar akun.

**Pemilik (penjual)**: satu orang yang memasak dan menjadi kasir. Tangan sering sibuk, jadi dashboard dibuka di **HP** sambil bekerja. Butuh tombol besar, sedikit langkah, dan bunyi saat ada pesanan baru. Kadang membuka dashboard di tablet atau laptop untuk laporan.

## 4. Ruang lingkup v1

### 4.1 Sisi pelanggan

| ID | Fitur |
|---|---|
| P1 | Akses lewat **satu link/QR** untuk semua pelanggan (ditempel di meja dan kasir) |
| P2 | Lihat menu per kategori (Makanan, Minuman), lengkap dengan harga, foto (opsional), dan label **Habis** |
| P3 | Pilih **pilihan menu** (contoh: Cotto Ayam → Laksa/Mie/Nasi; Mie → Kuah/Goreng, + Telur) dan tulis **catatan** per item |
| P4 | Keranjang: ubah jumlah, hapus item, lihat total |
| P5 | Checkout: pilih **Makan di sini / Bungkus**, isi **nama** (wajib) dan **no. HP** (opsional), pilih **QRIS / Cash** |
| P6 | Setelah memesan, pelanggan mendapat **nomor antrean harian** (#001…) |
| P7 | Bayar QRIS: tampil gambar QRIS DANA Bisnis dan **total besar**, lalu tombol **"Saya sudah bayar"** |
| P8 | Halaman **lacak pesanan** dengan status terbaru (Baru → Dimasak → Siap → Selesai / Batal) dan status bayar |
| P9 | Kartu **Paket Dos 25rb** dengan tombol **Pesan via WhatsApp** (pesan sudah terisi) |
| P10 | Saat toko **Tutup**, menu tetap bisa dilihat tetapi tidak bisa memesan |

### 4.2 Sisi pemilik (dashboard)

| ID | Fitur |
|---|---|
| D1 | Login pemilik (1 akun, email + password) |
| D2 | **Pesanan live**: pesanan baru muncul otomatis dengan **bunyi notifikasi**, dikelompokkan per status |
| D3 | Ubah status pesanan dengan **satu tombol**: Mulai masak → Siap → Selesai. Ada tombol **Batal** dengan alasan opsional |
| D4 | Tandai **Lunas** (QRIS maupun cash). Pesanan belum lunas diberi tanda merah, dan pesanan "pelanggan klaim sudah bayar QRIS" diberi tanda kuning |
| D5 | Toggle **Buka/Tutup toko** |
| D6 | **Kelola menu**: tambah/ubah/hapus menu dan kategori, harga, foto, urutan, grup pilihan, serta toggle **Habis** |
| D7 | **Riwayat pesanan**: filter per tanggal/rentang tanggal, lihat detail |
| D8 | **Laporan**: omzet hari ini & bulan ini, jumlah pesanan, menu terlaris, total Cash vs QRIS |
| D9 | **Catatan keuangan**: pemasukan otomatis (dari pesanan lunas) + **pengeluaran manual** (tanggal, keterangan, nominal, kategori Bahan/Operasional/Lainnya), lalu **laba kotor** harian/bulanan |
| D10 | **Poster QR**: poster berisi logo, QR, dan tulisan "Scan untuk pesan", siap dicetak (A4/A5) atau diunduh (PNG) |
| D11 | **Pengaturan**: upload gambar QRIS, nomor WhatsApp, nama & tagline toko, harga Paket Dos |

### 4.3 Di luar lingkup v1 (fase berikutnya)

- Payment gateway (QRIS dinamis, verifikasi otomatis)
- Print struk ke printer thermal
- Promo/diskon, ulasan/rating
- Ekspor laporan ke Excel
- Jam buka otomatis per hari
- Delivery
- Domain sendiri
- Akun staf/multi-peran
- Pre-order Paket Dos di aplikasi

## 5. User stories & kriteria penerimaan

### Pelanggan

**US-01: Melihat menu**
Sebagai pelanggan, saya ingin melihat menu dan harga di HP agar bisa memilih tanpa bertanya.
- [ ] Membuka link/QR menampilkan menu dalam < 3 detik di koneksi 4G.
- [ ] Menu dikelompokkan per kategori, dan tab kategori tetap terlihat saat menggulir.
- [ ] Menu yang **Habis** tetap tampil (abu-abu, badge "Habis") dan tombolnya tidak aktif.
- [ ] Kartu menu tanpa foto tetap rapi (memakai placeholder bermerek) dan kartu dengan foto tidak merusak tata letak.

**US-02: Memilih menu dengan pilihan**
- [ ] Menu yang punya grup pilihan membuka *bottom sheet*. Grup wajib harus dipilih sebelum tombol "Tambah" aktif.
- [ ] Tambahan berbayar (mis. Telur +3rb) langsung menambah harga yang ditampilkan.
- [ ] Pelanggan bisa menulis catatan (maks. 100 karakter).
- [ ] Menu yang sama dengan pilihan berbeda menjadi baris keranjang terpisah.

**US-03: Checkout**
- [ ] Nama wajib diisi (2–30 karakter). No. HP opsional, dan jika diisi harus berformat nomor Indonesia.
- [ ] Jenis pesanan (Makan di sini/Bungkus) dan metode bayar (QRIS/Cash) wajib dipilih.
- [ ] Total dihitung ulang di server dari harga di database (bukan dari HP pelanggan).
- [ ] Jika toko tutup atau ada menu yang baru saja habis, pesanan ditolak dengan pesan yang jelas, dan keranjang tidak hilang.
- [ ] Tombol kirim tidak bisa ditekan dua kali (mencegah pesanan ganda).

**US-04: Bayar QRIS**
- [ ] Setelah pesan dengan QRIS, tampil gambar QRIS dan **total dalam huruf besar** beserta instruksi "Masukkan nominal persis Rp xx.xxx".
- [ ] Gambar QRIS bisa diperbesar dan disimpan.
- [ ] Tombol "Saya sudah bayar" mengubah status bayar menjadi **Menunggu verifikasi**.

**US-05: Bayar cash**
- [ ] Tampil instruksi "Bayar di kasir, sebutkan nama dan nomor #xxx".

**US-06: Melacak pesanan**
- [ ] Halaman lacak menampilkan nomor antrean besar, nama, daftar item, total, status masak, dan status bayar.
- [ ] Status diperbarui otomatis tanpa reload (maks. ±5 detik).
- [ ] Saat status menjadi **Siap**, HP bergetar (jika didukung) dan tampil pesan "Pesanan kamu siap! Silakan ambil."
- [ ] Link lacak tetap bisa dibuka ulang (tersimpan di HP pelanggan).

**US-07: Paket Dos**
- [ ] Tombol membuka WhatsApp ke nomor toko dengan pesan awal "Halo Rumah Makan Sipil, saya mau pesan Paket Dos…".

### Pemilik

**US-10: Pesanan masuk**
- [ ] Pesanan baru muncul di dashboard tanpa reload dalam ±2 detik, disertai bunyi notifikasi.
- [ ] Bunyi tetap terdengar selama halaman dashboard terbuka (pemilik diminta mengetuk "Aktifkan suara" sekali karena aturan browser).
- [ ] Kartu pesanan menampilkan: nomor antrean, nama, Makan di sini/Bungkus, item + pilihan + catatan, total, metode & status bayar, dan waktu pesan.

**US-11: Memproses pesanan**
- [ ] Satu tombol utama per kartu sesuai status: **Mulai masak**, **Siap**, atau **Selesai**.
- [ ] Tombol **Lunas** tersedia selama belum lunas, terpisah dari tombol status masak.
- [ ] **Batal** meminta konfirmasi. Pesanan batal tidak dihitung di laporan.
- [ ] Pesanan yang sudah lunas dan selesai pindah ke Riwayat.

**US-12: Buka/Tutup toko**
- [ ] Toggle di bagian atas dashboard, dengan status yang terlihat jelas.

**US-13: Kelola menu**
- [ ] CRUD kategori & menu. Harga dalam Rupiah bulat.
- [ ] Upload foto (JPG/PNG/WebP, maks. 5 MB). Foto otomatis dipotong rasio 4:3 dan dikompres.
- [ ] Grup pilihan: nama, tipe (*pilih satu* / *boleh lebih dari satu*), wajib/tidak, dan daftar opsi dengan tambahan harga.
- [ ] Toggle Habis berlaku langsung di halaman pelanggan.
- [ ] Mengubah harga **tidak** mengubah pesanan lama, karena harga disalin saat pesanan dibuat.

**US-14: Riwayat & laporan**
- [ ] Riwayat difilter per tanggal (default: hari ini).
- [ ] Laporan menampilkan: omzet (hanya pesanan lunas & tidak batal), jumlah pesanan, 5 menu terlaris, dan Cash vs QRIS, untuk hari ini dan bulan ini.

**US-15: Catatan keuangan**
- [ ] Tambah/ubah/hapus pengeluaran: tanggal, keterangan, nominal, kategori.
- [ ] Tampilan seperti buku kas per tanggal: pemasukan, pengeluaran, saldo/laba kotor.
- [ ] Ringkasan bulan: total pemasukan, total pengeluaran, laba kotor.

**US-16: Poster QR**
- [ ] Poster berisi logo/nama toko, QR ke link pemesanan, tulisan "Scan untuk pesan", dan tagline.
- [ ] Tombol **Cetak** (tata letak siap cetak) dan **Unduh PNG**.

## 6. Aturan bisnis

- **Nomor antrean** reset setiap hari pukul 00:00 **WITA** (Asia/Makassar), dimulai dari #001.
- **Status masak**: `baru → dimasak → siap → selesai`, atau `batal` dari status apa pun sebelum `selesai`.
- **Status bayar**: `belum_bayar → menunggu_verifikasi (khusus QRIS, setelah pelanggan tekan "Saya sudah bayar") → lunas`. Hanya pemilik yang bisa menandai lunas.
- Penjual bebas memasak sebelum atau sesudah lunas.
- **Omzet/pemasukan** = jumlah total pesanan berstatus `lunas` dan tidak `batal`, berdasarkan tanggal pesanan.
- Semua uang disimpan sebagai **bilangan bulat Rupiah**.

## 7. Asumsi & risiko

| Risiko | Dampak | Penanganan v1 |
|---|---|---|
| QRIS statis tidak bisa diverifikasi otomatis | Pelanggan bisa menekan "Sudah bayar" padahal belum | Pemilik wajib cek notifikasi DANA sebelum menandai Lunas. Status "Menunggu verifikasi" dibedakan dari "Lunas" |
| Pelanggan salah ketik nominal QRIS | Selisih uang | Total ditampilkan besar beserta instruksi nominal persis |
| Pesanan iseng (link bisa dibuka dari mana saja) | Pemilik memasak sia-sia | Hanya bisa pesan saat toko buka, batas maks. 3 pesanan / 10 menit per perangkat & IP, dan pemilik bisa Batal |
| Browser memblokir bunyi otomatis | Pesanan tak terdengar | Tombol "Aktifkan suara" + layar tetap menyala (Wake Lock) di dashboard |
| Domain diganti setelah QR dicetak | QR lama mati | Gunakan satu domain sejak awal. Jika ganti, cetak ulang poster dari dashboard |
| Koneksi HP lambat | Menu lama terbuka | Halaman ringan, gambar dikompres, dan menu di-cache |
