const assert = require('assert');
const { normalizeRole, hasPermission, PERMISSION_MATRIX } = require('./src/middleware/rbac');

console.log('--- SYSTEM RBAC MODULAR TEST SUITE ---');

// 1. Test Role Normalization
console.log('[1] Testing normalizeRole()...');
assert.strictEqual(normalizeRole('DEVELOPER', 1, 'admin'), 'PENGEMBANG');
assert.strictEqual(normalizeRole('ADMIN', 2, 'user1'), 'ADMINISTRATOR');
assert.strictEqual(normalizeRole('ADMIN_AKUNTANSI', 2, 'user2'), 'ADMIN_KEUANGAN');
assert.strictEqual(normalizeRole('FINANCE', 2, 'user3'), 'ADMIN_KEUANGAN');
assert.strictEqual(normalizeRole('ADMIN_GUDANG', 2, 'user4'), 'ADMIN_GUDANG');
assert.strictEqual(normalizeRole('WAREHOUSE', 2, 'user5'), 'ADMIN_GUDANG');
assert.strictEqual(normalizeRole('ADMIN_OPERATIONAL', 2, 'user6'), 'ADMIN_OPERASIONAL');
assert.strictEqual(normalizeRole('ADMIN_OPERASIONAL', 2, 'user7'), 'ADMIN_OPERASIONAL');
console.log('✅ normalizeRole() PASSED');

// 2. Test Permission Matrix for MOD_USERS
console.log('[2] Testing MOD_USERS permissions...');
const devUser = { role: 'PENGEMBANG', tenant_id: 1, username: 'admin' };
const adminUser = { role: 'ADMINISTRATOR', tenant_id: 2, username: 'adminpt' };
const finUser = { role: 'ADMIN_KEUANGAN', tenant_id: 2, username: 'fin' };
const whUser = { role: 'ADMIN_GUDANG', tenant_id: 2, username: 'wh' };
const opsUser = { role: 'ADMIN_OPERASIONAL', tenant_id: 2, username: 'ops' };

assert.strictEqual(hasPermission(devUser, 'MOD_USERS', 'CREATE'), true);
assert.strictEqual(hasPermission(adminUser, 'MOD_USERS', 'CREATE'), true);
assert.strictEqual(hasPermission(finUser, 'MOD_USERS', 'CREATE'), false);
assert.strictEqual(hasPermission(whUser, 'MOD_USERS', 'CREATE'), false);
assert.strictEqual(hasPermission(opsUser, 'MOD_USERS', 'CREATE'), false);
console.log('✅ MOD_USERS PASSED');

// 3. Test Permission Matrix for MOD_SUPERADMIN
console.log('[3] Testing MOD_SUPERADMIN permissions...');
assert.strictEqual(hasPermission(devUser, 'MOD_SUPERADMIN', 'READ'), true);
assert.strictEqual(hasPermission(adminUser, 'MOD_SUPERADMIN', 'READ'), false);
assert.strictEqual(hasPermission(finUser, 'MOD_SUPERADMIN', 'READ'), false);
assert.strictEqual(hasPermission(whUser, 'MOD_SUPERADMIN', 'READ'), false);
assert.strictEqual(hasPermission(opsUser, 'MOD_SUPERADMIN', 'READ'), false);
console.log('✅ MOD_SUPERADMIN PASSED');

// 4. Test Permission Matrix for MOD_INVENTORY
console.log('[4] Testing MOD_INVENTORY permissions...');
assert.strictEqual(hasPermission(whUser, 'MOD_INVENTORY', 'CREATE'), true);
assert.strictEqual(hasPermission(whUser, 'MOD_INVENTORY', 'DELETE'), true);
assert.strictEqual(hasPermission(finUser, 'MOD_INVENTORY', 'READ'), true);
assert.strictEqual(hasPermission(finUser, 'MOD_INVENTORY', 'CREATE'), false);
assert.strictEqual(hasPermission(opsUser, 'MOD_INVENTORY', 'READ'), true);
assert.strictEqual(hasPermission(opsUser, 'MOD_INVENTORY', 'CREATE'), false);
console.log('✅ MOD_INVENTORY PASSED');

// 5. Test Permission Matrix for MOD_COMMERCIAL
console.log('[5] Testing MOD_COMMERCIAL permissions...');
assert.strictEqual(hasPermission(opsUser, 'MOD_COMMERCIAL', 'CREATE'), true);
assert.strictEqual(hasPermission(finUser, 'MOD_COMMERCIAL', 'CREATE'), true);
assert.strictEqual(hasPermission(whUser, 'MOD_COMMERCIAL', 'READ'), true);
assert.strictEqual(hasPermission(whUser, 'MOD_COMMERCIAL', 'UPDATE'), true); // status DO update
assert.strictEqual(hasPermission(whUser, 'MOD_COMMERCIAL', 'CREATE'), false);
console.log('✅ MOD_COMMERCIAL PASSED');

// 6. Test Permission Matrix for MOD_ACCOUNTING
console.log('[6] Testing MOD_ACCOUNTING permissions...');
assert.strictEqual(hasPermission(finUser, 'MOD_ACCOUNTING', 'CREATE'), true);
assert.strictEqual(hasPermission(finUser, 'MOD_ACCOUNTING', 'READ'), true);
assert.strictEqual(hasPermission(whUser, 'MOD_ACCOUNTING', 'READ'), false);
assert.strictEqual(hasPermission(opsUser, 'MOD_ACCOUNTING', 'READ'), false);
console.log('✅ MOD_ACCOUNTING PASSED');

console.log('\n🎉 ALL RBAC VERIFICATION TESTS PASSED SUCCESSFULLY!');

