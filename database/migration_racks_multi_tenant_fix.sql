-- Migration: Multi-tenant Rack Index Fix
-- Mengubah index unik kode_rak menjadi unik per tenant (tenant_id, kode_rak)
-- agar setiap PT / Tenant dapat memiliki kode rak masing-masing tanpa konflik.

ALTER TABLE `racks` DROP INDEX `kode_rak`;
ALTER TABLE `racks` ADD UNIQUE KEY `uq_rack_tenant` (`tenant_id`, `kode_rak`);

