/**
 * Helper untuk resolusi tenant_id secara aman dan konsisten.
 * Memastikan data PT A tidak pernah bocor ke PT B.
 */

const isSuperUser = (req) => {
  if (!req || !req.user) return false;
  const user = req.user;
  const role = (user.role || '').toUpperCase();
  return (
    role === 'PENGEMBANG' ||
    role === 'DEVELOPER' ||
    role === 'SUPERADMIN' ||
    user.username === 'admin'
  );
};

const getTenantId = (req) => {
  if (!req || !req.user) return 1;
  const isSuper = isSuperUser(req);
  if (isSuper && req.query) {
    if (req.query.tenant_id === 'all') return null;
    if (req.query.tenant_id) return Number(req.query.tenant_id);
  }
  return Number(req.user.tenant_id || 1);
};

const getTargetTenantId = (req) => {
  if (!req || !req.user) return 1;
  const isSuper = isSuperUser(req);
  if (isSuper && req.body && req.body.tenant_id) {
    return Number(req.body.tenant_id);
  }
  return Number(req.user.tenant_id || 1);
};

module.exports = {
  isSuperUser,
  getTenantId,
  getTargetTenantId,
};
