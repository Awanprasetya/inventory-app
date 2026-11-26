-- ============================================================================
-- MIGRASI: ROLE PERMISSIONS (RBAC MATRIKS HAK AKSES PER MENU)
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NULL,
  role VARCHAR(50) NOT NULL,
  menu_key VARCHAR(100) NOT NULL,
  is_allowed TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_role_menu (tenant_id, role, menu_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

