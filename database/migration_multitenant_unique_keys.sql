-- ============================================================================
-- MIGRASI: MULTI-TENANT SCOPED UNIQUE INDEXES FIX
-- Memastikan seluruh kode (gudang, produk, supplier, customer, PO, SO, DO, dll)
-- unik PER TENANT / PERUSAHAAN, bukan global antar perusahaan.
-- ============================================================================

-- 1. Gudang & Lokasi
ALTER TABLE `warehouses` DROP INDEX `kode_gudang`;
ALTER TABLE `warehouses` ADD UNIQUE INDEX `uq_warehouse_tenant` (`tenant_id`, `kode_gudang`);

-- 2. Produk & Katalog
ALTER TABLE `products` DROP INDEX `kode_produk`;
ALTER TABLE `products` ADD UNIQUE INDEX `uq_product_tenant` (`tenant_id`, `kode_produk`);

-- 3. Supplier & Customer
ALTER TABLE `suppliers` DROP INDEX `kode_supplier`;
ALTER TABLE `suppliers` ADD UNIQUE INDEX `uq_supplier_tenant` (`tenant_id`, `kode_supplier`);

ALTER TABLE `customers` DROP INDEX `kode_customer`;
ALTER TABLE `customers` ADD UNIQUE INDEX `uq_customer_tenant` (`tenant_id`, `kode_customer`);

-- 4. Transaksi & Dokumen Komersial
ALTER TABLE `purchase_orders` DROP INDEX `no_po`;
ALTER TABLE `purchase_orders` ADD UNIQUE INDEX `uq_po_tenant` (`tenant_id`, `no_po`);

ALTER TABLE `sales_orders` DROP INDEX `no_so`;
ALTER TABLE `sales_orders` ADD UNIQUE INDEX `uq_so_tenant` (`tenant_id`, `no_so`);

ALTER TABLE `delivery_orders` DROP INDEX `no_do`;
ALTER TABLE `delivery_orders` ADD UNIQUE INDEX `uq_do_tenant` (`tenant_id`, `no_do`);

ALTER TABLE `sales_quotations` DROP INDEX `no_quotation`;
ALTER TABLE `sales_quotations` ADD UNIQUE INDEX `uq_quotation_tenant` (`tenant_id`, `no_quotation`);

ALTER TABLE `purchase_returns` DROP INDEX `no_return`;
ALTER TABLE `purchase_returns` ADD UNIQUE INDEX `uq_purch_return_tenant` (`tenant_id`, `no_return`);

ALTER TABLE `sales_returns` DROP INDEX `no_return`;
ALTER TABLE `sales_returns` ADD UNIQUE INDEX `uq_sales_return_tenant` (`tenant_id`, `no_return`);

-- 5. Operasional Stok & Mutasi
ALTER TABLE `stock_adjustments` DROP INDEX `no_adjustment`;
ALTER TABLE `stock_adjustments` ADD UNIQUE INDEX `uq_adj_tenant` (`tenant_id`, `no_adjustment`);

ALTER TABLE `warehouse_transfers` DROP INDEX `no_transfer`;
ALTER TABLE `warehouse_transfers` ADD UNIQUE INDEX `uq_trf_tenant` (`tenant_id`, `no_transfer`);

ALTER TABLE `transactions` DROP INDEX `kode_transaksi`;
ALTER TABLE `transactions` ADD UNIQUE INDEX `uq_trans_tenant` (`tenant_id`, `kode_transaksi`);

-- 6. Akuntansi & Keuangan
ALTER TABLE `accounts` DROP INDEX `kode_akun`;
ALTER TABLE `accounts` ADD UNIQUE INDEX `uq_account_tenant` (`tenant_id`, `kode_akun`);

ALTER TABLE `journal_entries` DROP INDEX `no_jurnal`;
ALTER TABLE `journal_entries` ADD UNIQUE INDEX `uq_journal_tenant` (`tenant_id`, `no_jurnal`);

ALTER TABLE `cash_transactions` DROP INDEX `no_transaksi`;
ALTER TABLE `cash_transactions` ADD UNIQUE INDEX `uq_cash_trans_tenant` (`tenant_id`, `no_transaksi`);

