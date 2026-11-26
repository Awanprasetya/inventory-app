require('dotenv').config();

const mysql = require('mysql2/promise');

// Pool koneksi ke MySQL (database `inventory`)
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123Awan@',
  database: process.env.DB_NAME || 'inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Kembalikan DATE/DATETIME sebagai string agar tidak ada pergeseran timezone
  dateStrings: true,
});

module.exports = pool;
