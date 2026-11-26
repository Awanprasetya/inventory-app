const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

// GET /api/superadmin/tenants
const getTenants = asyncHandler(async (req, res) => {
  const [tenants] = await pool.query(
    `SELECT t.*,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS total_users,
            (SELECT GROUP_CONCAT(tm.kode_modul) FROM tenant_modules tm WHERE tm.tenant_id = t.id AND tm.is_active = 1) AS active_modules
     FROM tenants t
     ORDER BY t.id DESC`
  );

  const formatted = tenants.map((t) => ({
    ...t,
    modules: t.active_modules ? t.active_modules.split(',') : [],
  }));

  res.json({ success: true, data: formatted });
});

// POST /api/superadmin/tenants (Buat Perusahaan Tenant Baru + User Admin Pertama)
const createTenant = asyncHandler(async (req, res) => {
  const {
    kode_tenant,
    nama_perusahaan,
    email_pemilik,
    telepon,
    status = 'ACTIVE',
    expired_at,
    modules = ['MOD_INVENTORY', 'MOD_COMMERCIAL', 'MOD_ACCOUNTING'],
    admin_nama,
    admin_username,
    admin_password,
  } = req.body;

  if (!kode_tenant || !nama_perusahaan || !email_pemilik || !admin_username || !admin_password) {
    throw new ApiError(
      400,
      'Kode tenant, nama perusahaan, email pemilik, username admin, dan password admin wajib diisi.'
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check duplicate kode_tenant or email
    const [dup] = await conn.query(
      'SELECT id FROM tenants WHERE kode_tenant = ? OR email_pemilik = ? LIMIT 1',
      [kode_tenant, email_pemilik]
    );
    if (dup.length > 0) {
      throw new ApiError(409, 'Kode tenant atau email pemilik sudah terdaftar dalam sistem.');
    }

    // 2. Insert tenant
    const defaultExp = expired_at || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    const [tRes] = await conn.query(
      `INSERT INTO tenants (kode_tenant, nama_perusahaan, email_pemilik, telepon, status, expired_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [kode_tenant, nama_perusahaan, email_pemilik, telepon || null, status, defaultExp]
    );
    const tenantId = tRes.insertId;

    // 3. Insert active modules
    for (const mod of modules) {
      await conn.query(
        `INSERT INTO tenant_modules (tenant_id, kode_modul, is_active) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE is_active = 1`,
        [tenantId, mod]
      );
    }

    // 4. Create first Admin user for tenant
    const hashedPassword = bcrypt.hashSync(admin_password, 10);
    await conn.query(
      `INSERT INTO users (tenant_id, nama_lengkap, username, password, role)
       VALUES (?, ?, ?, ?, 'ADMINISTRATOR')`,
      [tenantId, admin_nama || `Admin ${nama_perusahaan}`, admin_username, hashedPassword]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: `Tenant "${nama_perusahaan}" (${kode_tenant}) berhasil didaftarkan!`,
      data: { tenantId },
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// PUT /api/superadmin/tenants/:id (Update Status, Masa Sewa, & Modul Aktif)
const updateTenant = asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.id);
  const { nama_perusahaan, email_pemilik, telepon, status, expired_at, modules } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM tenants WHERE id = ? LIMIT 1', [tenantId]);
    if (existing.length === 0) {
      throw new ApiError(404, 'Tenant tidak ditemukan.');
    }

    await conn.query(
      `UPDATE tenants
       SET nama_perusahaan = COALESCE(?, nama_perusahaan),
           email_pemilik = COALESCE(?, email_pemilik),
           telepon = COALESCE(?, telepon),
           status = COALESCE(?, status),
           expired_at = COALESCE(?, expired_at)
       WHERE id = ?`,
      [nama_perusahaan || null, email_pemilik || null, telepon || null, status || null, expired_at || null, tenantId]
    );

    // Update active modules if provided
    if (Array.isArray(modules)) {
      // Deactivate all modules first
      await conn.query('UPDATE tenant_modules SET is_active = 0 WHERE tenant_id = ?', [tenantId]);
      // Activate requested modules
      for (const mod of modules) {
        await conn.query(
          `INSERT INTO tenant_modules (tenant_id, kode_modul, is_active) VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE is_active = 1`,
          [tenantId, mod]
        );
      }
    }

    await conn.commit();
    res.json({
      success: true,
      message: `Lisensi & data tenant berhasil diperbarui.`,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// DELETE /api/superadmin/tenants/:id
const deleteTenant = asyncHandler(async (req, res) => {
  const tenantId = Number(req.params.id);
  if (tenantId === 1) {
    throw new ApiError(400, 'Tenant utama default tidak boleh dihapus.');
  }
  await pool.query('DELETE FROM tenants WHERE id = ?', [tenantId]);
  res.json({ success: true, message: 'Tenant berhasil dihapus.' });
});

module.exports = {
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
};

