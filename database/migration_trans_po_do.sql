-- ============================================================
-- MIGRASI: Penambahan kolom PO dan DO pada tabel transactions
-- ============================================================

ALTER TABLE transactions 
ADD COLUMN purchase_order_id INT NULL DEFAULT NULL AFTER user_id,
ADD COLUMN delivery_order_id INT NULL DEFAULT NULL AFTER purchase_order_id,
ADD CONSTRAINT fk_trans_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_trans_do FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id) ON DELETE SET NULL;

