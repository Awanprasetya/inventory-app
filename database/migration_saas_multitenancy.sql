-- ============================================================================
-- MIGRASI: SAAS MULTI-TENANCY & MODULE LICENSING (MVP)
-- ============================================================================

-- 1. Tabel Perusahaan Tenant (Klien SaaS)
CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kode_tenant VARCHAR(50) UNIQUE NOT NULL,
    nama_perusahaan VARCHAR(150) NOT NULL,
    email_pemilik VARCHAR(100) NOT NULL UNIQUE,
    telepon VARCHAR(30) NULL,
    status ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED') DEFAULT 'ACTIVE',
    expired_at DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed Tenant Pertama (Tenant Default Perusahaan Utama)
INSERT IGNORE INTO tenants (id, kode_tenant, nama_perusahaan, email_pemilik, telepon, status, expired_at)
VALUES (1, 'TENANT-001', 'PT JARUM PATAH MEDICAL', 'admin@jarumpatah.co.id', '021-8983011', 'ACTIVE', '2030-12-31');

-- 3. Tabel Lisensi Modul Tenant
CREATE TABLE IF NOT EXISTS tenant_modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    kode_modul VARCHAR(50) NOT NULL, -- MOD_INVENTORY, MOD_COMMERCIAL, MOD_ACCOUNTING
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY uk_tenant_module (tenant_id, kode_modul)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Modul Lengkap untuk Tenant 1
INSERT IGNORE INTO tenant_modules (tenant_id, kode_modul, is_active) VALUES
(1, 'MOD_INVENTORY', 1),
(1, 'MOD_COMMERCIAL', 1),
(1, 'MOD_ACCOUNTING', 1);

-- 4. Stored Procedure untuk Tambah tenant_id ke Semua Tabel Bisnis (Aman Dijalankan Berulang)
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS add_tenant_id_to_all_tables()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE tbl_name VARCHAR(64);
    DECLARE cur CURSOR FOR 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
          AND table_name NOT IN ('tenants', 'tenant_modules', 'subscription_plans', 'tenant_subscriptions');
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur;

    read_loop: LOOP
        FETCH cur INTO tbl_name;
        IF done THEN
            LEAVE read_loop;
        END IF;

        SET @col_exists = (
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_schema = DATABASE() 
              AND table_name = tbl_name 
              AND column_name = 'tenant_id'
        );

        IF @col_exists = 0 THEN
            SET @alter_sql = CONCAT('ALTER TABLE `', tbl_name, '` ADD COLUMN `tenant_id` INT NOT NULL DEFAULT 1 FIRST');
            PREPARE stmt FROM @alter_sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END LOOP;

    CLOSE cur;
END //
DELIMITER ;

CALL add_tenant_id_to_all_tables();
DROP PROCEDURE IF EXISTS add_tenant_id_to_all_tables;

