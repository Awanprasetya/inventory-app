# Inventory App

Aplikasi manajemen stok gudang **full-stack**: backend **Node.js + Express + MySQL** dan frontend **React (Vite) + Tailwind CSS + Lucide Icons**. Mendukung alur scan barcode untuk barang masuk/keluar, master data produk & lokasi rak, serta laporan Kartu Stok realtime.

## Fitur

| Halaman | Fungsi |
|---|---|
| **Dashboard** | Ringkasan total produk/stok, mutasi masuk-keluar hari ini, grafik 7 hari terakhir, peringatan stok menipis/habis |
| **Barang Masuk** | Scan barcode produk atau lot → isi qty → transaksi `MASUK` (lot baru otomatis dibuat, stok & mutasi tercatat) |
| **Barang Keluar** | Scan lot (atau produk lalu pilih lot) → keranjang multi-item → transaksi `KELUAR` dengan validasi stok cukup |
| **Produk & Rak** | CRUD master produk (kode, nama, satuan, rak) + CRUD lokasi rak, pencarian produk |
| **Kartu Stok** | Riwayat mutasi per produk dengan saldo berjalan, filter periode tanggal |
| **Login & RBAC** | Halaman login (bcrypt + JWT), sesi di localStorage, role `ADMINISTRATOR` & `ADMIN_GUDANG` |
| **Manajemen User** | CRUD user + ganti password + role — **khusus ADMINISTRATOR** (backend & frontend) |

Backend menerapkan **transaksi database** (`BEGIN/COMMIT/ROLLBACK`) + row lock (`FOR UPDATE`) agar stok konsisten saat akses bersamaan, serta pesan error berbahasa Indonesia lewat middleware terpusat.

## Autentikasi & Role-Based Access Control

| Akses | ADMINISTRATOR | ADMIN_GUDANG |
|---|---|---|
| Dashboard, Barang Masuk/Keluar, Produk & Rak, Kartu Stok | ✅ | ✅ |
| Halaman **Manajemen User** | ✅ | ❌ (halaman 403) |
| API `/api/users/*` | ✅ | ❌ **403 dari backend** |

- Semua endpoint API (kecuali `/api/health` & `POST /api/auth/login`) **wajib** `Authorization: Bearer <token>`.
- Token JWT disimpan di `localStorage`; interceptor axios menyisipkan token otomatis dan me-redirect ke `/login` saat respons **401** (sesi kedaluwarsa).
- `user_id` pada tabel `transactions` diisi otomatis dari user yang login (tampil sebagai "Diinput oleh" di riwayat).

**Akun default** (sudah ada di `database/seed.sql` / `migration_users.sql`, password di-hash bcrypt):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | ADMINISTRATOR |
| `gudang01` | `gudang123` | ADMIN_GUDANG |

## Struktur Proyek

```
inventory-app/
├── backend/                  # Node.js + Express + MySQL
│   ├── src/
│   │   ├── config/db.js      # Pool koneksi mysql2
│   │   ├── controllers/      # product, rack, transaction, dashboard, auth, user
│   │   ├── models/           # Query SQL (product, rack, transaction, dashboard, user)
│   │   ├── routes/           # productRoutes, transactionRoutes, dashboardRoutes, authRoutes, userRoutes
│   │   ├── middleware/       # errorHandler (asyncHandler) + auth (authenticate & requireRole)
│   │   └── server.js         # Entry point
│   ├── .env                  # DB, JWT_SECRET, port
│   ├── package.json
│   └── .gitignore
├── frontend/                 # React + Vite + Tailwind + Lucide
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── components/       # Layout, Sidebar, Navbar, Modal, ProtectedRoute, RoleRoute
│   │   ├── context/          # AuthContext (login, sesi, role)
│   │   ├── pages/            # Login, Dashboard, Inbound, Outbound, Products, StockCard, Users
│   │   ├── services/api.js   # Axios + interceptor Bearer token & auto-logout 401
│   │   ├── App.jsx / main.jsx / index.css
│   ├── tailwind.config.js / postcss.config.js / vite.config.js
│   └── package.json
├── database/
│   ├── inventory.sql         # Struktur tabel (dump phpMyAdmin + tabel users)
│   ├── migration_users.sql   # Migrasi users untuk database yang SUDAH ADA (aman diulang)
│   └── seed.sql              # Data contoh + user login untuk demo (opsional)
└── README.md
```

## Prasyarat

- **Node.js** ≥ 18 (diuji dengan Node 24)
- **MySQL** 8.x berjalan di `127.0.0.1:3306`
- Browser modern (Chrome/Edge)

## Cara Menjalankan

### 1. Siapkan Database

**Install baru** — lewat **phpMyAdmin** (import):

1. Buat database bernama `inventory` (utf8mb4).
2. Import `database/inventory.sql` (struktur tabel termasuk `users`).
3. *(Opsional)* Import `database/seed.sql` untuk data demo + akun login — **peringatan: mengosongkan data tabel**.

**Database yang sudah ada** — cukup jalankan migrasi (aman diulang):

4. Import `database/migration_users.sql` (membuat tabel `users`, mengisi akun default, mengisi `user_id` transaksi yang masih kosong).

Atau lewat CLI:

```bash
mysql -uroot -p -e "CREATE DATABASE inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -uroot -p inventory < database/inventory.sql
mysql -uroot -p inventory < database/seed.sql   # opsional (install baru)

# atau untuk database yang sudah ada:
mysql -uroot -p inventory < database/migration_users.sql
```

### 2. Backend

```bash
cd backend
npm install
# sesuaikan isi .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
npm run dev        # development (nodemon), atau: npm start
```

Server berjalan di `http://localhost:5000` — cek `GET /api/health`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Alamat backend bisa dioverride lewat file `.env` frontend:

```
VITE_API_URL=http://localhost:5000/api
```

## Daftar Endpoint API

> Semua endpoint di bawah (kecuali `/api/health` dan `/api/auth/login`) membutuhkan header `Authorization: Bearer <token>` hasil login.

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/health` | publik | Health check |
| POST | `/api/auth/login` | publik | Login, mengembalikan `{ token, user }` |
| GET | `/api/auth/me` | login | Profil user pada token aktif |
| GET | `/api/users` | ADMINISTRATOR | Daftar user |
| POST | `/api/users` | ADMINISTRATOR | Tambah user (password di-hash bcrypt) |
| PUT | `/api/users/:id` | ADMINISTRATOR | Edit user (password dikirim = ganti) |
| DELETE | `/api/users/:id` | ADMINISTRATOR | Hapus user (akun sendiri ditolak) |
| GET | `/api/dashboard/summary` | login | Ringkasan + daftar stok menipis |
| GET | `/api/dashboard/chart` | Grafik mutasi 7 hari |
| GET | `/api/products?search=` | Daftar produk + total stok |
| GET | `/api/products/:kode` | Detail produk |
| GET | `/api/products/:kode/lots` | Lot milik produk |
| POST/PUT/DELETE | `/api/products[/:kode]` | CRUD produk |
| GET | `/api/lots?kode_produk=` | Semua lot |
| GET | `/api/lots/:nomor` | Detail lot (dipakai saat scan) |
| GET/POST/PUT/DELETE | `/api/racks[/:id]` | CRUD lokasi rak |
| POST | `/api/transactions/inbound` | Transaksi MASUK |
| POST | `/api/transactions/outbound` | Transaksi KELUAR (multi item) |
| GET | `/api/transactions?type=MASUK\|KELUAR` | Riwayat transaksi + detail |
| GET | `/api/transactions/:kode` | Detail transaksi |
| GET | `/api/stock-card/:kode_produk?from=&to=` | Laporan Kartu Stok |

Contoh body inbound:

```json
{
  "kode_produk": "PRD-001",
  "nomor_lot": "LOT-TRG-2601",
  "qty": 50,
  "tanggal_produksi": "2026-10-06",
  "shift": 1,
  "referensi": "PO-2026-001"
}
```

> `tanggal_produksi` & `shift` hanya wajib saat **lot baru**; qty harus bilangan bulat > 0.

## Catatan

- `backend/.env` **tidak boleh** di-commit (sudah masuk `.gitignore`). Isinya termasuk kredensial database dan `JWT_SECRET` (rahasia tanda tangan token — ganti jika ingin token di-reset).
- `JWT_EXPIRES_IN=1d` mengatur masa berlaku token (default `1d`). Setelah kedaluwarsa, frontend otomatis dialihkan ke halaman login.
- Kode transaksi dibuat otomatis, format `IN-YYYYMMDD-XXXX` / `OUT-YYYYMMDD-XXXX`, dan selalu menyimpan `user_id` pemasok.
- Menghapus produk akan ikut menghapus lot-nya (`ON DELETE CASCADE`); menghapus rak membuat `rack_id` produk menjadi `NULL`.
- Threshold "stok menipis" pada dashboard = `≤ 10 unit` (lihat `backend/src/models/dashboardModel.js`).
