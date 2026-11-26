const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const productRoutes = require('./routes/productRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const customerRoutes = require('./routes/customerRoutes');
const poRoutes = require('./routes/poRoutes');
const soRoutes = require('./routes/soRoutes');
const doRoutes = require('./routes/doRoutes');
const payableRoutes = require('./routes/payableRoutes');
const receivableRoutes = require('./routes/receivableRoutes');
const accountingRoutes = require('./routes/accountingRoutes');
const inventoryCommercialRoutes = require('./routes/inventoryCommercialRoutes');
const rbacRoutes = require('./routes/rbacRoutes');
const { authenticate } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// CORS: izinkan frontend (serp.aproject.site, erp.aproject.site, localhost, dll)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root: petunjuk untuk yang membuka port backend langsung di browser
app.get('/', (req, res) => {
  const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  res.json({
    success: true,
    message: 'Ini adalah server API Inventory. Aplikasi frontend berjalan di port lain.',
    frontend: frontendUrl,
    gunakan: [
      `GET  ${frontendUrl}            -> Buka aplikasi (React)`,
      'GET  /api/health               -> Health check',
      'GET  /api/dashboard/summary    -> Ringkasan dashboard',
      'GET  /api/dashboard/chart      -> Grafik mutasi 7 hari',
      'GET  /api/products             -> Daftar produk',
      'GET  /api/racks                -> Daftar rak',
      'GET  /api/transactions?type=MASUK -> Riwayat transaksi',
      'GET  /api/stock-card/:kode     -> Kartu stok',
    ],
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Inventory API berjalan',
    timestamp: new Date().toISOString(),
  });
});

// Daftar endpoint
// 1) Autentikasi: login publik, /me pakai token masing-masing
app.use('/api/auth', authRoutes);
// 2) Semua endpoint API lain wajib login (Bearer token)
app.use('/api', authenticate);
// 3) Route yang sudah terotentikasi
app.use('/api', userRoutes);
app.use('/api', productRoutes);
app.use('/api', transactionRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', supplierRoutes);
app.use('/api', customerRoutes);
app.use('/api', poRoutes);
app.use('/api', soRoutes);
app.use('/api', doRoutes);
app.use('/api', payableRoutes);
app.use('/api', receivableRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api', inventoryCommercialRoutes);
app.use('/api', rbacRoutes);
app.use('/api/superadmin', require('./routes/superadminRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
if (typeof PhusionPassenger !== 'undefined') {
  app.listen('passenger', () => {
    console.log('Server Inventory berjalan di Phusion Passenger');
  });
} else {
  app.listen(PORT, () => {
    console.log(`Server Inventory berjalan di port ${PORT}`);
  });
}

module.exports = app;
