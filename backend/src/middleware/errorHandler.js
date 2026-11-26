// Bungkus handler async agar error langsung diteruskan ke middleware errorHandler
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Error khusus dengan status HTTP (dipakai di controller)
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// 404 untuk route yang tidak dikenal
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route tidak ditemukan: ${req.method} ${req.originalUrl}`,
  });
};

// Middleware penangan error terpusat
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Terjadi kesalahan pada server';

  if (err.code === 'ER_DUP_ENTRY') {
    status = 409;
    message = 'Data sudah ada (duplikat), periksa kembali input Anda';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 400;
    message = 'Data terkait tidak ditemukan';
  } else if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    status = 400;
    message = 'Data tidak dapat dihapus karena masih digunakan';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Format JSON tidak valid';
  }

  if (status >= 500) {
    console.error('[SERVER ERROR]', err);
  }

  res.status(status).json({ success: false, message });
};

module.exports = { asyncHandler, ApiError, notFound, errorHandler };
