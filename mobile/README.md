# Syntesia ERP - Mobile App (Barang Masuk & Barang Keluar)

Aplikasi mobile Flutter untuk operasional gudang modern yang terintegrasi langsung dengan backend ERP Syntesia, mendukung pemindaian barcode fisik melalui kamera smartphone.

---

## 📱 Fitur Utama

### 1. 📥 Modul Barang Masuk (Inbound)
- **Scan Barcode Kamera**:
  - Pindai barcode produk, dus kemasan box, atau nomor lot fisik secara instan.
  - Otomatis kalkulasi kemasan (contoh: 1 Box = 24 pcs, scan 2x otomatis menjadi 2 Box = 48 pcs).
- **Integrasi Purchase Order (PO)**:
  - Opsi memilih nomor PO aktif dari supplier.
  - Memilih item barang dari PO dengan sisa kuantitas pesanan.
- **Manajemen Batch & Lot**:
  - Auto-generate nomor lot berstandar gudang (`LOT-YYYYMMDD-XXXX`).
  - Pemilihan shift kerja (Shift 1, 2, 3) otomatis mengikuti jam kerja saat ini.
  - Input tanggal produksi & tanggal kedaluwarsa (Expired Date).
  - Pilihan status lot: `AVAILABLE`, `QUARANTINE`, `HOLD`.
- **Riwayat Penerimaan**:
  - Daftar 10 transaksi barang masuk terakhir secara real-time.

---

### 2. 📤 Modul Barang Keluar (Outbound)
- **Scan Barcode Kamera**:
  - Scan langsung nomor lot pada barang fisik yang akan dikirim.
  - Scan barcode produk untuk menampilkan rekomendasi lot dengan metode **FEFO (First Expired First Out)** — memprioritaskan lot dengan tanggal expired paling dekat.
- **Proteksi Mutu Medis & Karantina (BPOM / Quality Control)**:
  - Sistem otomatis **menolak & memblokir** pengeluaran barang jika lot berstatus `QUARANTINE`, `HOLD`, atau `EXPIRED`.
- **Keranjang Pengeluaran (Multi-Item Cart)**:
  - Menampung banyak item/lot sekaligus sebelum disubmit.
  - Stepper pengubah Qty (+ / -) dengan validasi stok maksimum (tidak dapat melebihi sisa stok lot).
- **Integrasi Delivery Order (DO)**:
  - Memilih nomor DO customer yang sedang menunggu pengiriman (`DRAFT`/`PENDING`).
- **Riwayat Pengeluaran**:
  - Daftar transaksi keluar terakhir lengkap dengan status dan total item.

---

### 3. 📷 Fitur Scanner Barcode Kamera (`MobileScanner`)
- Viewfinder visual dengan animasi laser pemindaian.
- Tombol Senter/Flashlight untuk pemindaian di area gudang yang minim pencahayaan.
- Tombol Switch Kamera (Kamera Belakang / Depan).
- **Fallback Input Manual**: Jika label barcode rusak, basah, atau tidak terbaca, operator dapat langsung mengetik nomor barcode secara manual.

---

### 4. 🌐 Fleksibilitas Koneksi Backend (Server URL)
Di layar Login atau tab Profil, terdapat pengaturan **Base URL API**:
- **Android Emulator**: `http://10.0.2.2:5000/api`
- **HP Fisik (Wi-Fi Lokal)**: `http://192.168.x.x:5000/api` (sesuaikan dengan IP laptop/komputer server)
- **Desktop / Web**: `http://localhost:5000/api`
- Dilengkapi tombol **"Uji Koneksi"** untuk memvalidasi keterhubungan jaringan sebelum login.

---

## 🚀 Cara Menjalankan Aplikasi Mobile

### Prasyarat
- Flutter SDK (3.x ke atas)
- Backend berjalan di port 5000 (`npm run dev` atau `node src/server.js`)
- Smartphone Android (USB Debugging / Wi-Fi) atau Android Emulator

### Menjalankan ke Emulator / Perangkat:
```bash
cd mobile

# Mengambil dependencies
flutter pub get

# Menjalankan aplikasi
flutter run
```

Untuk memilih target perangkat spesifik:
```bash
# Cek ID perangkat yang terhubung
flutter devices

# Jalankan ke perangkat tertentu
flutter run -d <device_id>
```

---

## 📂 Struktur Direktori `mobile/`
```
mobile/
├── lib/
│   ├── main.dart                      # Entry point & Theme ERP
│   ├── models/                        # Data Models
│   │   ├── user_model.dart
│   │   ├── product_model.dart
│   │   ├── lot_model.dart
│   │   ├── warehouse_model.dart
│   │   ├── po_model.dart
│   │   ├── do_model.dart
│   │   └── transaction_model.dart
│   ├── providers/
│   │   └── auth_provider.dart         # State auth & token session
│   ├── services/
│   │   └── api_service.dart           # HTTP Client & REST API endpoints
│   ├── widgets/
│   │   ├── barcode_scanner_view.dart  # Scanner Barcode Kamera full-feature
│   │   └── status_badge.dart          # Status chip badge visual
│   └── screens/
│       ├── login_screen.dart          # Login & Server API Config
│       ├── home_screen.dart           # Dashboard & Navigation Bar
│       ├── inbound_screen.dart        # Modul Barang Masuk
│       └── outbound_screen.dart       # Modul Barang Keluar
```
