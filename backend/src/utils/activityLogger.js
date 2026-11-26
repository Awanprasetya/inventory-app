const pool = require('../config/db');

/**
 * Catat jejak audit aktivitas (Audit Log Trail)
 * @param {Object} req Object Express Request
 * @param {string} action Aksi yang dilakukan (cth: 'CREATE_INBOUND', 'UPDATE_LICENSE', 'STOCK_OPNAME')
 * @param {string} module Modul ERP (cth: 'INVENTORY', 'COMMERCIAL', 'ACCOUNTING', 'SUPERADMIN')
 * @param {string|Object} details Detail informasi tambahan
 */
const logActivity = async (req, action, module, details = null) => {
  try {
    const tenantId = req?.user?.tenant_id || null;
    const userId = req?.user?.id || null;
    const username = req?.user?.username || 'SYSTEM';
    const detailStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, username, action, module, details) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, userId, username, action, module, detailStr]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
};

/**
 * Ambil daftar aktivitas log berdasarkan tenantId
 */
const getLogs = async (tenantId = null, limit = 50) => {
  let sql = `SELECT id, tenant_id, user_id, username, action, module, details, created_at FROM activity_logs`;
  const params = [];
  if (tenantId) {
    sql += ` WHERE tenant_id = ? OR tenant_id IS NULL`;
    params.push(tenantId);
  }
  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(Number(limit));

  const [rows] = await pool.query(sql, params);
  return rows;
};

module.exports = {
  logActivity,
  getLogs,
};

