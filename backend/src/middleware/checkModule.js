const { ApiError } = require('./errorHandler');

const { normalizeRole } = require('./rbac');

const checkModule = (requiredModule) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Silakan login terlebih dahulu'));
  }

  // 1. Cek status sewa berlangganan tenant
  if (req.user.tenant_status === 'EXPIRED' || req.user.tenant_status === 'SUSPENDED') {
    return next(
      new ApiError(
        402,
        `Masa sewa berlangganan untuk "${req.user.tenant_name || 'perusahaan Anda'}" telah berakhir / ditangguhkan. Silakan hubungi penyedia SaaS untuk perpanjangan lisensi.`
      )
    );
  }

  // Cek tanggal kadaluarsa sewa jika diset
  if (req.user.tenant_expired_at) {
    const expDate = new Date(req.user.tenant_expired_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expDate < today) {
      return next(
        new ApiError(
          402,
          `Masa sewa berlangganan (${req.user.tenant_name}) telah berakhir pada ${req.user.tenant_expired_at}. Silakan hubungi penyedia SaaS untuk perpanjangan.`
        )
      );
    }
  }

  // Pengembang / SuperAdmin & Administrator Perusahaan selalu diizinkan mengakses seluruh modul tenant
  const role = normalizeRole(req.user.role, req.user.tenant_id, req.user.username);
  if (role === 'PENGEMBANG' || role === 'ADMINISTRATOR') {
    return next();
  }

  // 2. Cek lisensi modul spesifik untuk pengguna biasa
  if (requiredModule) {
    const modules = req.user.modules || [];
    if (!modules.includes(requiredModule)) {
      return next(
        new ApiError(
          403,
          `Modul '${requiredModule}' belum diaktifkan pada lisensi langganan Anda. Silakan hubungi penyedia SaaS untuk mengaktifkan modul ini.`
        )
      );
    }
  }

  next();
};

module.exports = checkModule;

