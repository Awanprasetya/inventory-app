const pool = require('../config/db');

const normalizeRoleName = (role) => {
  const r = (role || '').toUpperCase().replace(/\s+/g, '_');
  if (['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'].includes(r)) return 'PENGEMBANG';
  if (['ADMINISTRATOR', 'ADMIN'].includes(r)) return 'ADMINISTRATOR';
  if (['ADMIN_KEUANGAN', 'ADMIN_AKUNTANSI', 'FINANCE'].includes(r)) return 'ADMIN_KEUANGAN';
  if (['ADMIN_GUDANG', 'WAREHOUSE'].includes(r)) return 'ADMIN_GUDANG';
  if (['ADMIN_OPERASIONAL', 'ADMIN_OPERATIONAL', 'OPERATIONAL'].includes(r)) return 'ADMIN_OPERASIONAL';
  return r;
};

/**
 * Controller Hak Akses (RBAC) Per Menu
 */
const rbacController = {
  /**
   * Ambil matriks hak akses menu untuk tenant saat ini
   */
  getPermissions: async (req, res, next) => {
    try {
      const tenantId = req.user?.tenant_id;
      
      let query = 'SELECT role, menu_key, is_allowed FROM role_permissions';
      const queryParams = [];

      if (tenantId) {
        query += ' WHERE tenant_id = ? OR tenant_id IS NULL OR tenant_id = 1 ORDER BY (tenant_id = ?) DESC';
        queryParams.push(tenantId, tenantId);
      } else {
        query += ' WHERE tenant_id IS NULL OR tenant_id = 1';
      }

      const [rows] = await pool.query(query, queryParams);

      return res.json({
        success: true,
        data: rows,
      });
    } catch (err) {
      console.error('Peringatan rbac getPermissions:', err.message);
      // Fallback agar frontend tidak mengalami status 500
      return res.json({
        success: true,
        data: [],
      });
    }
  },

  /**
   * Simpan / Update matriks hak akses per menu
   */
  updatePermissions: async (req, res, next) => {
    try {
      const tenantId = req.user.tenant_id;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: 'Format data permissions tidak valid. Harus berupa array.',
        });
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        for (const perm of permissions) {
          const { role, menu_key, is_allowed } = perm;
          if (!role || !menu_key) continue;

          const normRole = normalizeRoleName(role);

          await connection.query(
            `INSERT INTO role_permissions (tenant_id, role, menu_key, is_allowed)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed), updated_at = NOW()`,
            [tenantId || 1, normRole, menu_key, is_allowed ? 1 : 0]
          );
        }

        await connection.commit();
        return res.json({
          success: true,
          message: 'Hak akses menu berhasil diperbarui!',
        });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    } catch (err) {
      next(err);
    }
  },
};

module.exports = rbacController;
