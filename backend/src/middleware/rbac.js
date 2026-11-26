const { ApiError } = require('./errorHandler');

/**
 * PETA PERMISSION RBAC MODULAR PER ROLE & OPERASI CRUD
 * -------------------------------------------------------------
 * Role:
 * - PENGEMBANG / DEVELOPER / SUPERADMIN: Full CRUD All Modules & All Tenants
 * - ADMINISTRATOR: Full CRUD All Modules within Tenant
 * - ADMIN_KEUANGAN / ADMIN_AKUNTANSI: Full CRUD Accounting & AP/AR; Read Commercial/Inventory
 * - ADMIN_GUDANG: Full CRUD Inventory, Warehouse, Stock & Lots; Read Commercial
 * - ADMIN_OPERASIONAL / ADMIN_OPERATIONAL: Full CRUD Commercial (PO, SO, DO, SQ, Retur, Supplier/Customer); Read Inventory
 */

const ROLE_ALIAS = {
  PENGEMBANG: ['PENGEMBANG', 'DEVELOPER', 'SUPERADMIN'],
  ADMINISTRATOR: ['ADMINISTRATOR', 'ADMIN'],
  ADMIN_KEUANGAN: ['ADMIN_KEUANGAN', 'ADMIN_AKUNTANSI', 'FINANCE'],
  ADMIN_GUDANG: ['ADMIN_GUDANG', 'WAREHOUSE'],
  ADMIN_OPERASIONAL: ['ADMIN_OPERASIONAL', 'ADMIN_OPERATIONAL', 'OPERATIONAL'],
};

const normalizeRole = (role, tenantId = null, username = null) => {
  const r = (role || '').toUpperCase();
  if (ROLE_ALIAS.PENGEMBANG.includes(r)) {
    return 'PENGEMBANG';
  }
  if (ROLE_ALIAS.ADMINISTRATOR.includes(r)) return 'ADMINISTRATOR';
  if (ROLE_ALIAS.ADMIN_KEUANGAN.includes(r)) return 'ADMIN_KEUANGAN';
  if (ROLE_ALIAS.ADMIN_GUDANG.includes(r)) return 'ADMIN_GUDANG';
  if (ROLE_ALIAS.ADMIN_OPERASIONAL.includes(r)) return 'ADMIN_OPERASIONAL';
  return 'ADMINISTRATOR'; // Default fallback
};

/**
 * Matriks Hak Akses Modul & Operasi CRUD
 */
const PERMISSION_MATRIX = {
  MOD_USERS: {
    PENGEMBANG: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMINISTRATOR: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMIN_KEUANGAN: [],
    ADMIN_GUDANG: [],
    ADMIN_OPERASIONAL: [],
  },
  MOD_SUPERADMIN: {
    PENGEMBANG: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMINISTRATOR: [],
    ADMIN_KEUANGAN: [],
    ADMIN_GUDANG: [],
    ADMIN_OPERASIONAL: [],
  },
  MOD_INVENTORY: {
    PENGEMBANG: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMINISTRATOR: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMIN_GUDANG: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMIN_OPERASIONAL: ['READ'],
    ADMIN_KEUANGAN: ['READ'],
  },
  MOD_COMMERCIAL: {
    PENGEMBANG: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMINISTRATOR: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMIN_OPERASIONAL: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMIN_KEUANGAN: ['CREATE', 'READ', 'UPDATE', 'DELETE'], // untuk AP/AR & Pembayaran
    ADMIN_GUDANG: ['READ', 'UPDATE'], // untuk DO shipping status update
  },
  MOD_ACCOUNTING: {
    PENGEMBANG: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMINISTRATOR: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMIN_KEUANGAN: ['CREATE', 'READ', 'UPDATE', 'DELETE'],
    ADMIN_GUDANG: [],
    ADMIN_OPERASIONAL: [],
  },
};

/**
 * Helper untuk mengecek apakah user memiliki hak akses terhadap modul dan aksi CRUD tertentu
 */
const hasPermission = (user, moduleName, action = 'READ') => {
  if (!user) return false;
  const role = normalizeRole(user.role, user.tenant_id, user.username);

  // Pengembang / SuperAdmin selalu diizinkan
  if (role === 'PENGEMBANG') return true;

  // Tenant Admin diizinkan pada seluruh modul perusahaannya
  if (role === 'ADMINISTRATOR' && moduleName !== 'MOD_SUPERADMIN') return true;

  const modulePerms = PERMISSION_MATRIX[moduleName];
  if (!modulePerms) return true;

  const allowedActions = modulePerms[role] || [];
  return allowedActions.includes(action.toUpperCase());
};

/**
 * Middleware Express untuk memeriksa Hak Akses RBAC berdasarkan Modul & Operasi CRUD
 * @param {string} moduleName Nama modul (cth: 'MOD_INVENTORY', 'MOD_COMMERCIAL', 'MOD_ACCOUNTING', 'MOD_USERS')
 * @param {string} action Aksi CRUD ('CREATE' | 'READ' | 'UPDATE' | 'DELETE')
 */
const checkPermission = (moduleName, action = 'READ') => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Silakan login terlebih dahulu'));
  }

  const role = normalizeRole(req.user.role, req.user.tenant_id, req.user.username);

  if (!hasPermission(req.user, moduleName, action)) {
    const roleLabels = {
      PENGEMBANG: 'Pengembang / Developer',
      ADMINISTRATOR: 'Administrator Perusahaan',
      ADMIN_KEUANGAN: 'Admin Keuangan & Akuntansi',
      ADMIN_GUDANG: 'Admin Gudang & Stok',
      ADMIN_OPERASIONAL: 'Admin Operasional & Sales',
    };
    return next(
      new ApiError(
        403,
        `Akses Ditolak: Role ${roleLabels[role] || role} tidak memiliki izin untuk operasi [${action}] pada modul [${moduleName}].`
      )
    );
  }

  next();
};

module.exports = {
  ROLE_ALIAS,
  normalizeRole,
  PERMISSION_MATRIX,
  hasPermission,
  checkPermission,
};

