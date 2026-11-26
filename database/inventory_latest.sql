-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: inventory
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `inventory`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `inventory` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `inventory`;

--
-- Table structure for table `accounting_periods`
--

DROP TABLE IF EXISTS `accounting_periods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounting_periods` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `tahun` int NOT NULL,
  `bulan` int NOT NULL,
  `tanggal_tutup` date NOT NULL,
  `status` enum('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `total_pendapatan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_beban` decimal(15,2) NOT NULL DEFAULT '0.00',
  `laba_bersih` decimal(15,2) NOT NULL DEFAULT '0.00',
  `closing_journal_id` int DEFAULT NULL,
  `closed_by` int DEFAULT NULL,
  `catatan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_periode` (`tahun`,`bulan`),
  KEY `closed_by` (`closed_by`),
  CONSTRAINT `accounting_periods_ibfk_1` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounting_periods`
--

LOCK TABLES `accounting_periods` WRITE;
/*!40000 ALTER TABLE `accounting_periods` DISABLE KEYS */;
/*!40000 ALTER TABLE `accounting_periods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_akun` varchar(20) NOT NULL,
  `nama_akun` varchar(150) NOT NULL,
  `kategori` enum('ASSET','LIABILITY','EQUITY','REVENUE','COGS','EXPENSE') NOT NULL,
  `subkategori` varchar(100) DEFAULT NULL,
  `saldo_normal` enum('DEBIT','KREDIT') NOT NULL,
  `is_kas_bank` tinyint(1) NOT NULL DEFAULT '0',
  `deskripsi` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_tenant` (`tenant_id`,`kode_akun`),
  KEY `idx_acc_kategori` (`kategori`),
  KEY `idx_acc_kode` (`kode_akun`),
  KEY `idx_acc_kas_bank` (`is_kas_bank`)
) ENGINE=InnoDB AUTO_INCREMENT=272 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts`
--

LOCK TABLES `accounts` WRITE;
/*!40000 ALTER TABLE `accounts` DISABLE KEYS */;
INSERT INTO `accounts` VALUES (1,1,'1-1001','Kas Operasional Gudang','ASSET','Kas & Bank','DEBIT',1,'Kas tunai operasional gudang dan kantor',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,2,'1-1002','Bank BCA - Rekening Utama','ASSET','Kas & Bank','DEBIT',1,'Rekening giro/operasional Bank BCA',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,3,'1-1003','Bank Mandiri - Rekening Operasional','ASSET','Kas & Bank','DEBIT',1,'Rekening operasional Bank Mandiri',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,4,'1-1010','Piutang Usaha (AR)','ASSET','Piutang','DEBIT',0,'Tagihan piutang dagang kepada pelanggan',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,5,'1-1020','Persediaan Barang Dagang','ASSET','Persediaan','DEBIT',0,'Nilai persediaan barang di gudang',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,6,'1-1030','Pajak Dibayar di Muka (PPN Masukan)','ASSET','Pajak Dibayar di Muka','DEBIT',0,'PPN masukan dari transaksi pembelian',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,7,'2-1001','Utang Usaha (AP)','LIABILITY','Kewajiban Lancar','KREDIT',0,'Kewajiban utang dagang kepada supplier',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,8,'2-1002','Utang Pajak (PPN Keluaran)','LIABILITY','Kewajiban Lancar','KREDIT',0,'PPN keluaran dari transaksi penjualan',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,9,'2-1003','Utang Biaya & Operasional','LIABILITY','Kewajiban Lancar','KREDIT',0,'Beban operasional yang masih harus dibayar',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,10,'3-1001','Modal Pemilik / Disetor','EQUITY','Modal','KREDIT',0,'Modal awal dan setoran pemilik perusahaan',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,11,'3-2001','Laba Ditahan','EQUITY','Laba Ditahan','KREDIT',0,'Akumulasi laba ditahan periode sebelumnya',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,12,'3-3001','Laba Periode Berjalan','EQUITY','Ekuitas Periode Berjalan','KREDIT',0,'Laba bersih operasional tahun/bulan berjalan',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,13,'4-1001','Pendapatan Penjualan Produk','REVENUE','Pendapatan Usaha','KREDIT',0,'Hasil penjualan barang dagang kepada customer',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,14,'4-1002','Diskon Penjualan','REVENUE','Kontra Pendapatan','DEBIT',0,'Potongan harga / diskon yang diberikan ke customer',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,15,'4-2001','Pendapatan Lain-lain & Jasa','REVENUE','Pendapatan Non-Usaha','KREDIT',0,'Pendapatan di luar operasional utama',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,16,'5-1001','Beban Pokok Penjualan (HPP)','COGS','Beban Pokok','DEBIT',0,'Harga pokok barang dagang yang terjual / keluar',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,17,'6-1001','Beban Gaji & Upah Karyawan','EXPENSE','Beban Karyawan','DEBIT',0,'Gaji staf gudang, operasional, dan administrasi',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,18,'6-1002','Beban Sewa Gedung & Gudang','EXPENSE','Beban Fasilitas','DEBIT',0,'Biaya sewa ruang gudang dan kantor',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,19,'6-1003','Beban Listrik, Air & Internet','EXPENSE','Beban Utilitas','DEBIT',0,'Tagihan utilitas PLN, PAM, dan internet kantor',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,20,'6-1004','Beban Logistik & Pengiriman','EXPENSE','Beban Operasional','DEBIT',0,'Biaya kurir, bensin, dan armada kirim',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,21,'6-1005','Beban Pemasaran & Promosi','EXPENSE','Beban Pemasaran','DEBIT',0,'Biaya periklanan dan promosi penjualan',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,22,'6-1006','Beban Perlengkapan & ATK','EXPENSE','Beban Administrasi','DEBIT',0,'Biaya pembelian alat tulis, lakban, packaging',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,23,'6-1007','Beban Administrasi Bank','EXPENSE','Beban Keuangan','DEBIT',0,'Biaya transfer bank dan administrasi rekening',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,24,'6-1099','Beban Operasional Lainnya','EXPENSE','Beban Operasional','DEBIT',0,'Pengeluaran operasional lain yang belum terinci',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,25,'1-2001','Aset Tetap - Kendaraan & Logistik','ASSET','Aset Tetap','DEBIT',0,'Kendaraan operasional dan pengiriman',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,26,'1-2002','Aset Tetap - Peralatan Gudang & Kantor','ASSET','Aset Tetap','DEBIT',0,'Peralatan gudang, barcode scanner, komputer, rak aset',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,27,'1-2009','Akumulasi Penyusutan Aset Tetap','ASSET','Kontra Aset Tetap','KREDIT',0,'Kontra aset: total akumulasi depresiasi aset tetap',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,28,'2-1004','Utang Pajak PPh (PPh 21/23/4(2))','LIABILITY','Kewajiban Lancar','KREDIT',0,'Titipan pemotongan pajak PPh yang harus disetor ke kas negara',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,29,'4-2002','Keuntungan Selisih Kurs (Forex Gain)','REVENUE','Pendapatan Non-Usaha','KREDIT',0,'Laba atas selisih kurs mata uang asing',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,30,'6-1020','Beban Penyusutan Aset Tetap (Depreciation)','EXPENSE','Beban Penyusutan','DEBIT',0,'Depresiasi aset tetap bulanan',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,31,'6-1021','Kerugian Selisih Kurs (Forex Loss)','EXPENSE','Beban Lainnya','DEBIT',0,'Rugi akibat selisih kurs mata uang asing',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,32,'6-1022','Beban Pajak Penghasilan','EXPENSE','Beban Pajak','DEBIT',0,'Beban pajak PPh badan / operasional',1,'2026-10-07 02:58:43','2026-10-07 02:58:43'),(1,33,'4-1003','Retur Penjualan (Sales Return)','REVENUE','PENJUALAN','DEBIT',0,NULL,1,'2026-10-07 02:58:44','2026-10-07 02:58:44'),(1,34,'6-1030','Beban Kerusakan & Selisih Stok (Inventory Adjustment)','EXPENSE','BEBAN_OPERASIONAL','DEBIT',0,NULL,1,'2026-10-07 02:58:44','2026-10-07 02:58:44');
/*!40000 ALTER TABLE `accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_payable`
--

DROP TABLE IF EXISTS `accounts_payable`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_payable` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_tagihan` varchar(50) NOT NULL,
  `po_id` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `tanggal` date NOT NULL,
  `jatuh_tempo` date NOT NULL,
  `total_tagihan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_dibayar` decimal(15,2) NOT NULL DEFAULT '0.00',
  `sisa_utang` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('BELUM_LUNAS','SEBAGIAN','LUNAS') NOT NULL DEFAULT 'BELUM_LUNAS',
  `keterangan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ap_tenant` (`tenant_id`,`no_tagihan`),
  KEY `idx_ap_po` (`po_id`),
  KEY `idx_ap_supplier` (`supplier_id`),
  KEY `idx_ap_jatuh_tempo` (`jatuh_tempo`),
  KEY `idx_ap_status` (`status`),
  CONSTRAINT `accounts_payable_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `accounts_payable_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_payable`
--

LOCK TABLES `accounts_payable` WRITE;
/*!40000 ALTER TABLE `accounts_payable` DISABLE KEYS */;
INSERT INTO `accounts_payable` VALUES (1,7,'AP-PO-212122221',4,1,'2026-10-13','2026-11-07',22810500.00,0.00,22810500.00,'BELUM_LUNAS','Faktur Utang otomatis dari penerimaan barang PO PO-212122221','2026-10-13 08:13:37','2026-10-13 08:13:37');
/*!40000 ALTER TABLE `accounts_payable` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `accounts_receivable`
--

DROP TABLE IF EXISTS `accounts_receivable`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts_receivable` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_tagihan` varchar(50) NOT NULL,
  `so_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `tanggal` date NOT NULL,
  `jatuh_tempo` date NOT NULL,
  `total_tagihan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_dibayar` decimal(15,2) NOT NULL DEFAULT '0.00',
  `sisa_piutang` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('BELUM_LUNAS','SEBAGIAN','LUNAS') NOT NULL DEFAULT 'BELUM_LUNAS',
  `keterangan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ar_tenant` (`tenant_id`,`no_tagihan`),
  KEY `idx_ar_so` (`so_id`),
  KEY `idx_ar_customer` (`customer_id`),
  KEY `idx_ar_jatuh_tempo` (`jatuh_tempo`),
  KEY `idx_ar_status` (`status`),
  CONSTRAINT `accounts_receivable_ibfk_1` FOREIGN KEY (`so_id`) REFERENCES `sales_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `accounts_receivable_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accounts_receivable`
--

LOCK TABLES `accounts_receivable` WRITE;
/*!40000 ALTER TABLE `accounts_receivable` DISABLE KEYS */;
INSERT INTO `accounts_receivable` VALUES (1,12,'INV-SO/2026/10/1006',12,1,'2026-10-13','2026-11-12',152070.00,0.00,0.00,'LUNAS','Faktur Penjualan resmi dari SO SO/2026/10/1006','2026-10-13 08:39:11','2026-10-13 08:54:28');
/*!40000 ALTER TABLE `accounts_receivable` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_depreciations`
--

DROP TABLE IF EXISTS `asset_depreciations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_depreciations` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_id` int NOT NULL,
  `periode_bulan` varchar(7) NOT NULL,
  `tanggal_proses` date NOT NULL,
  `nominal_penyusutan` decimal(15,2) NOT NULL,
  `nilai_buku_setelahnya` decimal(15,2) NOT NULL,
  `journal_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asset_periode` (`asset_id`,`periode_bulan`),
  CONSTRAINT `asset_depreciations_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `fixed_assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_depreciations`
--

LOCK TABLES `asset_depreciations` WRITE;
/*!40000 ALTER TABLE `asset_depreciations` DISABLE KEYS */;
/*!40000 ALTER TABLE `asset_depreciations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_reconciliations`
--

DROP TABLE IF EXISTS `bank_reconciliations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_reconciliations` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_rekonsiliasi` varchar(50) NOT NULL,
  `account_bank_id` int NOT NULL,
  `periode_bulan` varchar(7) NOT NULL,
  `tanggal_rekon` date NOT NULL,
  `saldo_buku` decimal(15,2) NOT NULL DEFAULT '0.00',
  `saldo_bank` decimal(15,2) NOT NULL DEFAULT '0.00',
  `selisih` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('DRAFT','RECONCILED') NOT NULL DEFAULT 'DRAFT',
  `catatan` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bank_recon_tenant` (`tenant_id`,`no_rekonsiliasi`),
  KEY `account_bank_id` (`account_bank_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `bank_reconciliations_ibfk_1` FOREIGN KEY (`account_bank_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `bank_reconciliations_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_reconciliations`
--

LOCK TABLES `bank_reconciliations` WRITE;
/*!40000 ALTER TABLE `bank_reconciliations` DISABLE KEYS */;
/*!40000 ALTER TABLE `bank_reconciliations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_statement_items`
--

DROP TABLE IF EXISTS `bank_statement_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_statement_items` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `reconciliation_id` int NOT NULL,
  `tanggal` date NOT NULL,
  `keterangan` varchar(255) NOT NULL,
  `tipe` enum('MASUK','KELUAR') NOT NULL,
  `nominal` decimal(15,2) NOT NULL,
  `is_matched` tinyint(1) NOT NULL DEFAULT '0',
  `matched_journal_line_id` int DEFAULT NULL,
  `catatan` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reconciliation_id` (`reconciliation_id`),
  CONSTRAINT `bank_statement_items_ibfk_1` FOREIGN KEY (`reconciliation_id`) REFERENCES `bank_reconciliations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_statement_items`
--

LOCK TABLES `bank_statement_items` WRITE;
/*!40000 ALTER TABLE `bank_statement_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `bank_statement_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `budget_details`
--

DROP TABLE IF EXISTS `budget_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budget_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `budget_id` int NOT NULL,
  `account_id` int NOT NULL,
  `nominal_anggaran` decimal(15,2) NOT NULL DEFAULT '0.00',
  `catatan` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_budget_acc` (`budget_id`,`account_id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `budget_details_ibfk_1` FOREIGN KEY (`budget_id`) REFERENCES `budgets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `budget_details_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budget_details`
--

LOCK TABLES `budget_details` WRITE;
/*!40000 ALTER TABLE `budget_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `budget_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `budgets`
--

DROP TABLE IF EXISTS `budgets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `budgets` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `tahun` int NOT NULL,
  `judul_anggaran` varchar(150) NOT NULL,
  `divisi` varchar(100) NOT NULL DEFAULT 'Gudang & Operasional',
  `catatan` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_budget_tahun_divisi` (`tahun`,`divisi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `budgets`
--

LOCK TABLES `budgets` WRITE;
/*!40000 ALTER TABLE `budgets` DISABLE KEYS */;
/*!40000 ALTER TABLE `budgets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cash_transactions`
--

DROP TABLE IF EXISTS `cash_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cash_transactions` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_transaksi` varchar(50) NOT NULL,
  `tipe` enum('KELUAR','MASUK') NOT NULL,
  `tanggal` date NOT NULL,
  `account_kas_id` int NOT NULL,
  `account_lawan_id` int NOT NULL,
  `nominal` decimal(15,2) NOT NULL,
  `penerima_penyetor` varchar(150) DEFAULT NULL,
  `metode_pembayaran` varchar(50) NOT NULL DEFAULT 'Kas Tunai',
  `referensi` varchar(100) DEFAULT NULL,
  `keterangan` text NOT NULL,
  `journal_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cash_trans_tenant` (`tenant_id`,`no_transaksi`),
  KEY `account_lawan_id` (`account_lawan_id`),
  KEY `journal_id` (`journal_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_cash_tipe` (`tipe`),
  KEY `idx_cash_tanggal` (`tanggal`),
  KEY `idx_cash_account_kas` (`account_kas_id`),
  CONSTRAINT `cash_transactions_ibfk_1` FOREIGN KEY (`account_kas_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `cash_transactions_ibfk_2` FOREIGN KEY (`account_lawan_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `cash_transactions_ibfk_3` FOREIGN KEY (`journal_id`) REFERENCES `journal_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cash_transactions_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cash_transactions`
--

LOCK TABLES `cash_transactions` WRITE;
/*!40000 ALTER TABLE `cash_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `cash_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `currencies`
--

DROP TABLE IF EXISTS `currencies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `currencies` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `kode` varchar(5) NOT NULL,
  `nama` varchar(50) NOT NULL,
  `simbol` varchar(5) NOT NULL,
  `kurs_ke_idr` decimal(15,2) NOT NULL DEFAULT '1.00',
  `tanggal_kurs` date NOT NULL,
  `is_base` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`kode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `currencies`
--

LOCK TABLES `currencies` WRITE;
/*!40000 ALTER TABLE `currencies` DISABLE KEYS */;
INSERT INTO `currencies` VALUES (1,'EUR','Euro','€',17200.00,'2026-10-12',0,'2026-10-12 02:29:49'),(1,'IDR','Rupiah Indonesia','Rp',1.00,'2026-10-12',1,'2026-10-12 02:29:49'),(1,'SGD','Singapore Dollar','S$',12100.00,'2026-10-12',0,'2026-10-12 02:29:49'),(1,'USD','US Dollar','$',15800.00,'2026-10-12',0,'2026-10-12 02:29:49');
/*!40000 ALTER TABLE `currencies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_customer` varchar(50) NOT NULL,
  `nama_customer` varchar(150) NOT NULL,
  `telepon` varchar(30) DEFAULT NULL,
  `alamat_pengiriman` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_tenant` (`tenant_id`,`kode_customer`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,1,'CUST-001','PT. MAJU BERSAMA','0','TEST','2026-10-06 10:09:41'),(3,2,'CUST-001','PT. SINERGI BERSAMA','0','TEST','2026-10-08 08:23:21');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_order_details`
--

DROP TABLE IF EXISTS `delivery_order_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_order_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `do_id` int NOT NULL,
  `nomor_lot` varchar(100) NOT NULL,
  `qty_kirim` int NOT NULL,
  `satuan_order` varchar(20) DEFAULT 'PCS',
  `qty_order` decimal(10,2) DEFAULT NULL,
  `rasio_pcs` decimal(10,2) DEFAULT '1.00',
  PRIMARY KEY (`id`),
  KEY `do_id` (`do_id`),
  KEY `nomor_lot` (`nomor_lot`),
  CONSTRAINT `delivery_order_details_ibfk_1` FOREIGN KEY (`do_id`) REFERENCES `delivery_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_order_details`
--

LOCK TABLES `delivery_order_details` WRITE;
/*!40000 ALTER TABLE `delivery_order_details` DISABLE KEYS */;
INSERT INTO `delivery_order_details` VALUES (1,10,10,'LOT-SSU-2601',2,'PCS',NULL,1.00);
/*!40000 ALTER TABLE `delivery_order_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_orders`
--

DROP TABLE IF EXISTS `delivery_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_orders` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_do` varchar(50) NOT NULL,
  `so_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `tanggal_do` date NOT NULL,
  `status` enum('DRAFT','SHIPPED','DELIVERED') DEFAULT 'DRAFT',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_do_tenant` (`tenant_id`,`no_do`),
  KEY `so_id` (`so_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `delivery_orders_ibfk_1` FOREIGN KEY (`so_id`) REFERENCES `sales_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `delivery_orders_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_orders`
--

LOCK TABLES `delivery_orders` WRITE;
/*!40000 ALTER TABLE `delivery_orders` DISABLE KEYS */;
INSERT INTO `delivery_orders` VALUES (1,10,'DO/2026/10/4074',12,1,'2026-10-13','SHIPPED','2026-10-13 08:39:28');
/*!40000 ALTER TABLE `delivery_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fixed_assets`
--

DROP TABLE IF EXISTS `fixed_assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `fixed_assets` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_aset` varchar(50) NOT NULL,
  `nama_aset` varchar(150) NOT NULL,
  `kategori_aset` varchar(100) NOT NULL DEFAULT 'Peralatan',
  `account_asset_id` int NOT NULL,
  `account_accum_id` int NOT NULL,
  `account_expense_id` int NOT NULL,
  `tanggal_perolehan` date NOT NULL,
  `harga_perolehan` decimal(15,2) NOT NULL,
  `nilai_residu` decimal(15,2) NOT NULL DEFAULT '0.00',
  `masa_manfaat_bulan` int NOT NULL DEFAULT '48',
  `metode_penyusutan` enum('GARIS_LURUS','SALDO_MENURUN') NOT NULL DEFAULT 'GARIS_LURUS',
  `akumulasi_penyusutan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `nilai_buku` decimal(15,2) NOT NULL DEFAULT '0.00',
  `lokasi` varchar(100) DEFAULT NULL,
  `status` enum('AKTIF','DIJUAL','DIHAPUS') NOT NULL DEFAULT 'AKTIF',
  `keterangan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_asset_tenant` (`tenant_id`,`kode_aset`),
  KEY `account_asset_id` (`account_asset_id`),
  KEY `account_accum_id` (`account_accum_id`),
  KEY `account_expense_id` (`account_expense_id`),
  CONSTRAINT `fixed_assets_ibfk_1` FOREIGN KEY (`account_asset_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fixed_assets_ibfk_2` FOREIGN KEY (`account_accum_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fixed_assets_ibfk_3` FOREIGN KEY (`account_expense_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fixed_assets`
--

LOCK TABLES `fixed_assets` WRITE;
/*!40000 ALTER TABLE `fixed_assets` DISABLE KEYS */;
/*!40000 ALTER TABLE `fixed_assets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_entries`
--

DROP TABLE IF EXISTS `journal_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_entries` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_jurnal` varchar(50) NOT NULL,
  `tanggal` date NOT NULL,
  `tipe_referensi` enum('MANUAL','PO','SO','DO','INBOUND','OUTBOUND','AP_PAYMENT','AR_PAYMENT','EXPENSE','CASH_IN') NOT NULL DEFAULT 'MANUAL',
  `referensi_id` int DEFAULT NULL,
  `no_referensi` varchar(100) DEFAULT NULL,
  `keterangan` text NOT NULL,
  `total_debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_kredit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_journal_tenant` (`tenant_id`,`no_jurnal`),
  KEY `created_by` (`created_by`),
  KEY `idx_je_tanggal` (`tanggal`),
  KEY `idx_je_tipe_ref` (`tipe_referensi`),
  KEY `idx_je_no_ref` (`no_referensi`),
  CONSTRAINT `journal_entries_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_entries`
--

LOCK TABLES `journal_entries` WRITE;
/*!40000 ALTER TABLE `journal_entries` DISABLE KEYS */;
INSERT INTO `journal_entries` VALUES (1,30,'JU-202610-0001','2026-10-13','SO',6,'SO/2026/10/1163','Faktur Penjualan SO/2026/10/1163',2109000.00,2109000.00,1,'2026-10-13 08:09:15','2026-10-13 08:09:15'),(1,31,'JU-202610-0002','2026-10-13','INBOUND',12,'IN-20261013-JPTR','Penerimaan Barang Masuk (IN-20261013-JPTR) - Susu Bubuk 500g',20550000.00,20550000.00,1,'2026-10-13 08:13:37','2026-10-13 08:13:37'),(1,32,'JU-202610-0003','2026-10-13','SO',7,'SO/2026/10/7161','Faktur Penjualan SO/2026/10/7161',1520700.00,1520700.00,1,'2026-10-13 08:14:17','2026-10-13 08:14:17'),(1,39,'JU-202610-0005','2026-10-13','SO',11,'INV-SO/2026/10/4402','Faktur Penjualan INV-SO/2026/10/4402 (SO SO/2026/10/4402)',72500.00,72500.00,1,'2026-10-13 08:37:30','2026-10-13 08:37:30'),(1,40,'JU-202610-0006','2026-10-13','SO',12,'INV-SO/2026/10/1006','Faktur Penjualan INV-SO/2026/10/1006 (SO SO/2026/10/1006)',152070.00,152070.00,1,'2026-10-13 08:39:11','2026-10-13 08:39:11'),(1,41,'JU-202610-0007','2026-10-13','OUTBOUND',17,'DO/2026/10/4074','HPP Pengiriman DO DO/2026/10/4074 (OUT-20261013-STAH)',137000.00,137000.00,1,'2026-10-13 08:39:28','2026-10-13 08:39:28'),(1,45,'JU-202610-0008','2026-10-13','MANUAL',NULL,'SR-202610-8521','Retur Penjualan dari Customer (SR-202610-8521) - penok',274000.00,274000.00,1,'2026-10-13 08:54:28','2026-10-13 08:54:28');
/*!40000 ALTER TABLE `journal_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `journal_lines`
--

DROP TABLE IF EXISTS `journal_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `journal_lines` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_id` int NOT NULL,
  `account_id` int NOT NULL,
  `debit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `credit` decimal(15,2) NOT NULL DEFAULT '0.00',
  `keterangan` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jl_journal` (`journal_id`),
  KEY `idx_jl_account` (`account_id`),
  CONSTRAINT `journal_lines_ibfk_1` FOREIGN KEY (`journal_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `journal_lines_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `journal_lines`
--

LOCK TABLES `journal_lines` WRITE;
/*!40000 ALTER TABLE `journal_lines` DISABLE KEYS */;
INSERT INTO `journal_lines` VALUES (1,59,30,4,2109000.00,0.00,'Piutang Dagang SO/2026/10/1163','2026-10-13 08:09:15'),(1,60,30,13,0.00,1900000.00,'Pendapatan Penjualan SO/2026/10/1163','2026-10-13 08:09:15'),(1,61,30,8,0.00,209000.00,'PPN Keluaran SO/2026/10/1163','2026-10-13 08:09:15'),(1,62,31,5,20550000.00,0.00,'Persediaan Masuk (IN-20261013-JPTR)','2026-10-13 08:13:37'),(1,63,31,7,0.00,20550000.00,'Kewajiban Pembelian / Kas (IN-20261013-JPTR)','2026-10-13 08:13:37'),(1,64,32,4,1520700.00,0.00,'Piutang Dagang SO/2026/10/7161','2026-10-13 08:14:17'),(1,65,32,13,0.00,1370000.00,'Pendapatan Penjualan SO/2026/10/7161','2026-10-13 08:14:17'),(1,66,32,8,0.00,150700.00,'PPN Keluaran SO/2026/10/7161','2026-10-13 08:14:17'),(1,79,39,4,72500.00,0.00,'Piutang Dagang SO/2026/10/4402','2026-10-13 08:37:30'),(1,80,39,13,0.00,72500.00,'Pendapatan Penjualan SO/2026/10/4402','2026-10-13 08:37:30'),(1,81,40,4,152070.00,0.00,'Piutang Dagang SO/2026/10/1006','2026-10-13 08:39:11'),(1,82,40,13,0.00,137000.00,'Pendapatan Penjualan SO/2026/10/1006','2026-10-13 08:39:11'),(1,83,40,8,0.00,15070.00,'PPN Keluaran SO SO/2026/10/1006','2026-10-13 08:39:11'),(1,84,41,16,137000.00,0.00,'HPP DO DO/2026/10/4074','2026-10-13 08:39:28'),(1,85,41,5,0.00,137000.00,'Pengurangan Persediaan DO DO/2026/10/4074','2026-10-13 08:39:28'),(1,94,45,33,137000.00,0.00,'Retur Penjualan Produk (SR-202610-8521)','2026-10-13 08:54:28'),(1,95,45,4,0.00,137000.00,'Kredit Nota / Pengurangan Piutang (SR-202610-8521)','2026-10-13 08:54:28'),(1,96,45,5,137000.00,0.00,'Restock Persediaan Retur Penjualan (SR-202610-8521)','2026-10-13 08:54:28'),(1,97,45,16,0.00,137000.00,'Penyesuaian HPP Retur Penjualan (SR-202610-8521)','2026-10-13 08:54:28');
/*!40000 ALTER TABLE `journal_lines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payable_payments`
--

DROP TABLE IF EXISTS `payable_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payable_payments` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `payable_id` int NOT NULL,
  `no_pembayaran` varchar(50) NOT NULL,
  `tanggal_bayar` date NOT NULL,
  `jumlah_bayar` decimal(15,2) NOT NULL,
  `metode_pembayaran` varchar(50) NOT NULL DEFAULT 'Transfer Bank',
  `referensi_bayar` varchar(100) DEFAULT NULL,
  `catatan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ap_payment_tenant` (`tenant_id`,`no_pembayaran`),
  KEY `idx_pay_ap` (`payable_id`),
  KEY `idx_pay_ap_tgl` (`tanggal_bayar`),
  CONSTRAINT `payable_payments_ibfk_1` FOREIGN KEY (`payable_id`) REFERENCES `accounts_payable` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payable_payments`
--

LOCK TABLES `payable_payments` WRITE;
/*!40000 ALTER TABLE `payable_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payable_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_lots`
--

DROP TABLE IF EXISTS `product_lots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_lots` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_produk` varchar(50) NOT NULL,
  `nomor_lot` varchar(100) NOT NULL,
  `tanggal_produksi` date NOT NULL,
  `expired_date` date DEFAULT NULL,
  `shift` int NOT NULL,
  `warehouse_id` int DEFAULT '1',
  `stok_qty` int NOT NULL DEFAULT '0',
  `status` varchar(50) NOT NULL DEFAULT 'AVAILABLE',
  `keterangan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lot_warehouse` (`tenant_id`,`nomor_lot`,`warehouse_id`),
  KEY `kode_produk` (`kode_produk`),
  KEY `idx_nomor_lot` (`nomor_lot`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_lots`
--

LOCK TABLES `product_lots` WRITE;
/*!40000 ALTER TABLE `product_lots` DISABLE KEYS */;
INSERT INTO `product_lots` VALUES (1,1,'PRD-001','LOT-TRG-2601','2026-09-28',NULL,1,1,1200,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,2,'PRD-001','LOT-TRG-2602','2026-10-03',NULL,2,1,800,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,3,'PRD-002','LOT-GLA-2601','2026-09-30',NULL,1,1,450,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,4,'PRD-003','LOT-MYG-2601','2026-10-01',NULL,3,1,300,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,5,'PRD-004','LOT-SSU-2601','2026-10-02',NULL,1,1,118,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,6,'PRD-005','LOT-COK-2601','2026-10-04',NULL,2,1,60,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,7,'PRD-006','LOT-MRG-2601','2026-10-05',NULL,1,1,15,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,8,'PRD-007','LOT-RTW-2601','2026-10-06',NULL,1,1,0,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,9,'PRD-008','LOT-CHD-2601','2026-10-05',NULL,3,1,90,'AVAILABLE',NULL,'2026-10-12 02:29:50'),(1,10,'PD-001','PD00-261012-474','2026-10-12','2028-10-12',1,1,285,'AVAILABLE',NULL,'2026-10-12 02:54:47'),(1,11,'PD-001','LOT-121026-1','2026-10-12','2028-10-12',1,1,500,'AVAILABLE',NULL,'2026-10-12 03:34:31'),(1,12,'PD-001','PD-001-121026-1','2026-10-12','2028-10-12',1,1,100,'AVAILABLE',NULL,'2026-10-12 04:07:23'),(1,13,'PD-001','PD00-261012-474','2026-10-12','2028-10-12',1,2,10,'AVAILABLE',NULL,'2026-10-12 04:18:10'),(1,14,'PRD-004','PRD0-261013-568','2026-10-13','2028-10-13',2,1,302,'AVAILABLE',NULL,'2026-10-13 08:13:37');
/*!40000 ALTER TABLE `product_lots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_units`
--

DROP TABLE IF EXISTS `product_units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_units` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL DEFAULT '1',
  `product_id` int NOT NULL,
  `kode_produk` varchar(50) NOT NULL,
  `nama_satuan` varchar(50) NOT NULL,
  `isi_satuan_dasar` decimal(10,2) NOT NULL DEFAULT '1.00',
  `barcode_satuan` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prod_unit` (`tenant_id`,`kode_produk`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_units_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_units`
--

LOCK TABLES `product_units` WRITE;
/*!40000 ALTER TABLE `product_units` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_units` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_produk` varchar(50) NOT NULL,
  `nama_produk` varchar(150) NOT NULL,
  `satuan` varchar(20) NOT NULL,
  `satuan_besar` varchar(50) DEFAULT 'BOX',
  `satuan_menengah` varchar(50) DEFAULT 'PACK',
  `isi_pack_pcs` decimal(10,2) NOT NULL DEFAULT '1.00',
  `isi_box_pack` decimal(10,2) NOT NULL DEFAULT '1.00',
  `isi_box_pcs` decimal(10,2) NOT NULL DEFAULT '1.00',
  `isi_per_kemasan` decimal(10,2) NOT NULL DEFAULT '1.00',
  `barcode_kemasan` varchar(100) DEFAULT NULL,
  `harga` decimal(15,2) NOT NULL DEFAULT '0.00',
  `rack_id` int DEFAULT NULL,
  `metode_stok` varchar(10) NOT NULL DEFAULT 'FIFO',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_tenant` (`tenant_id`,`kode_produk`),
  KEY `kode_produk` (`kode_produk`),
  KEY `rack_id` (`rack_id`),
  KEY `idx_products_barcode_kemasan` (`tenant_id`,`barcode_kemasan`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,1,'PRD-001','Tepung Terigu Cakra','KG','BOX','PACK',1.00,1.00,1.00,1.00,NULL,14500.00,3,'FIFO','2026-10-12 02:29:50',0),(1,2,'PRD-002','Gula Pasir Gulaku','KG','BOX','PACK',1.00,1.00,1.00,1.00,NULL,17500.00,3,'FIFO','2026-10-12 02:29:50',0),(1,3,'PRD-003','Minyak Goreng 1L','PCS','BOX','PACK',1.00,1.00,1.00,1.00,NULL,24900.00,1,'FIFO','2026-10-12 02:29:50',0),(1,4,'PRD-004','Susu Bubuk 500g','BOX','BOX','PACK',1.00,1.00,1.00,1.00,NULL,68500.00,2,'FIFO','2026-10-12 02:29:50',0),(1,5,'PRD-005','Cokelat Batangan 1kg','KG','BOX','PACK',1.00,1.00,1.00,1.00,NULL,95000.00,4,'FIFO','2026-10-12 02:29:50',0),(1,6,'PRD-006','Margarine 200g','PCS','BOX','PACK',1.00,1.00,1.00,1.00,NULL,8500.00,5,'FIFO','2026-10-12 02:29:50',0),(1,7,'PRD-007','Roti Tawar Gandum','PCS','BOX','PACK',1.00,1.00,1.00,1.00,NULL,18000.00,1,'FIFO','2026-10-12 02:29:50',0),(1,8,'PRD-008','Keju Cheddar Block','KG','BOX','PACK',1.00,1.00,1.00,1.00,NULL,112000.00,4,'FIFO','2026-10-12 02:29:50',0),(1,9,'PD-001','JARUM SUNTIK 3ML','PCS','BOX','PACK',10.00,6.00,60.00,60.00,NULL,2500.00,1,'FEFO','2026-10-12 02:54:21',0);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_order_details`
--

DROP TABLE IF EXISTS `purchase_order_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `po_id` int NOT NULL,
  `kode_produk` varchar(50) NOT NULL,
  `qty_pesan` int NOT NULL,
  `harga_satuan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `diskon` decimal(15,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `qty_diterima` int DEFAULT '0',
  `satuan_order` varchar(20) DEFAULT 'PCS',
  `qty_order` decimal(10,2) DEFAULT NULL,
  `rasio_pcs` decimal(10,2) DEFAULT '1.00',
  PRIMARY KEY (`id`),
  KEY `po_id` (`po_id`),
  KEY `kode_produk` (`kode_produk`),
  CONSTRAINT `purchase_order_details_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order_details`
--

LOCK TABLES `purchase_order_details` WRITE;
/*!40000 ALTER TABLE `purchase_order_details` DISABLE KEYS */;
INSERT INTO `purchase_order_details` VALUES (1,1,1,'PRD-010',100,0.00,0.00,0.00,0,'PCS',NULL,1.00),(1,2,1,'PRD-009',20,0.00,0.00,0.00,0,'PCS',NULL,1.00),(1,3,2,'PRD-005',20,95000.00,0.00,1900000.00,20,'PCS',NULL,1.00),(1,4,2,'PRD-002',10,17500.00,0.00,175000.00,10,'PCS',NULL,1.00),(1,5,3,'PRD-008',10,112000.00,0.00,1120000.00,0,'PCS',NULL,1.00),(1,6,4,'PRD-004',300,68500.00,0.00,20550000.00,300,'PCS',NULL,1.00),(3,7,5,'PD-001',24,2500.00,0.00,60000.00,24,'PCS',NULL,1.00);
/*!40000 ALTER TABLE `purchase_order_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_po` varchar(50) NOT NULL,
  `supplier_id` int DEFAULT NULL,
  `tanggal_po` date NOT NULL,
  `termin_hari` int NOT NULL DEFAULT '30',
  `jatuh_tempo` date DEFAULT NULL,
  `status` enum('PENDING','APPROVED','COMPLETED','CANCELLED') DEFAULT 'PENDING',
  `keterangan` text,
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `diskon_persen` decimal(5,2) NOT NULL DEFAULT '0.00',
  `diskon_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `pajak_persen` decimal(5,2) NOT NULL DEFAULT '0.00',
  `pajak_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_harga` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_po_tenant` (`tenant_id`,`no_po`),
  KEY `supplier_id` (`supplier_id`),
  CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
INSERT INTO `purchase_orders` VALUES (1,1,'PO-2121222',1,'2026-10-06',30,'2026-11-05','COMPLETED','TEST',0.00,0.00,0.00,0.00,0.00,0.00,'2026-10-06 10:10:12'),(1,2,'PO/2026/10/5036',1,'2026-10-07',30,'2026-11-06','APPROVED','TEST',2075000.00,0.00,0.00,11.00,228250.00,2303250.00,'2026-10-07 04:22:48'),(1,3,'PO/2026/10/9568',1,'2026-10-07',30,'2026-11-06','PENDING',NULL,1120000.00,0.00,0.00,11.00,123200.00,1243200.00,'2026-10-07 06:21:06'),(1,4,'PO-212122221',1,'2026-10-08',30,'2026-11-07','COMPLETED',NULL,20550000.00,0.00,0.00,11.00,2260500.00,22810500.00,'2026-10-08 06:53:24'),(3,5,'PO/2026/10/7097',3,'2026-10-08',30,'2026-11-07','APPROVED',NULL,60000.00,0.00,0.00,11.00,6600.00,66600.00,'2026-10-08 08:21:17');
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_return_details`
--

DROP TABLE IF EXISTS `purchase_return_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_return_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `return_id` int NOT NULL,
  `product_id` int NOT NULL,
  `qty` int NOT NULL,
  `harga_satuan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `catatan` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_prd_return` (`return_id`),
  KEY `idx_prd_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_return_details`
--

LOCK TABLES `purchase_return_details` WRITE;
/*!40000 ALTER TABLE `purchase_return_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_return_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_returns`
--

DROP TABLE IF EXISTS `purchase_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_returns` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_return` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `po_id` int DEFAULT NULL,
  `supplier_id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `tanggal` date NOT NULL,
  `total_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `alasan_retur` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `tipe_penyelesaian` enum('POTONG_UTANG','PENGEMBALIAN_KAS','GANTI_BARANG') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'POTONG_UTANG',
  `status` enum('COMPLETED','DRAFT','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'COMPLETED',
  `journal_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purch_return_tenant` (`tenant_id`,`no_return`),
  KEY `idx_pr_supplier` (`supplier_id`),
  KEY `idx_pr_tanggal` (`tanggal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_returns`
--

LOCK TABLES `purchase_returns` WRITE;
/*!40000 ALTER TABLE `purchase_returns` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `racks`
--

DROP TABLE IF EXISTS `racks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `racks` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_rak` varchar(50) NOT NULL,
  `keterangan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rack_tenant` (`tenant_id`,`kode_rak`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `racks`
--

LOCK TABLES `racks` WRITE;
/*!40000 ALTER TABLE `racks` DISABLE KEYS */;
INSERT INTO `racks` VALUES (1,1,'RACK-A1','Aisle A baris 1 - barang jadi','2026-10-12 02:29:50'),(1,2,'RACK-A2','Aisle A baris 2 - barang jadi','2026-10-12 02:29:50'),(1,3,'RACK-B1','Aisle B baris 1 - bahan baku','2026-10-12 02:29:50'),(1,4,'RACK-B2','Aisle B baris 2 - bahan baku','2026-10-12 02:29:50'),(1,5,'RACK-C1','Aisle C baris 1 - bahan penolong','2026-10-12 02:29:50');
/*!40000 ALTER TABLE `racks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `receivable_payments`
--

DROP TABLE IF EXISTS `receivable_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `receivable_payments` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `receivable_id` int NOT NULL,
  `no_pembayaran` varchar(50) NOT NULL,
  `tanggal_bayar` date NOT NULL,
  `jumlah_bayar` decimal(15,2) NOT NULL,
  `metode_pembayaran` varchar(50) NOT NULL DEFAULT 'Transfer Bank',
  `referensi_bayar` varchar(100) DEFAULT NULL,
  `catatan` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ar_payment_tenant` (`tenant_id`,`no_pembayaran`),
  KEY `idx_pay_ar` (`receivable_id`),
  KEY `idx_pay_ar_tgl` (`tanggal_bayar`),
  CONSTRAINT `receivable_payments_ibfk_1` FOREIGN KEY (`receivable_id`) REFERENCES `accounts_receivable` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receivable_payments`
--

LOCK TABLES `receivable_payments` WRITE;
/*!40000 ALTER TABLE `receivable_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `receivable_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int DEFAULT NULL,
  `role` varchar(50) NOT NULL,
  `menu_key` varchar(100) NOT NULL,
  `is_allowed` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_menu` (`tenant_id`,`role`,`menu_key`)
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,1,'ADMINISTRATOR','/',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(2,1,'ADMINISTRATOR','/sales-quotations',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(3,1,'ADMINISTRATOR','/purchase-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(4,1,'ADMINISTRATOR','/sales-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(5,1,'ADMINISTRATOR','/delivery-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(6,1,'ADMINISTRATOR','/returns',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(7,1,'ADMINISTRATOR','/inbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(8,1,'ADMINISTRATOR','/outbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(9,1,'ADMINISTRATOR','/stock-adjustment',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(10,1,'ADMINISTRATOR','/batch-lots',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(11,1,'ADMINISTRATOR','/warehouses',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(12,1,'ADMINISTRATOR','/stock-card',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(13,1,'ADMINISTRATOR','/accounts-payable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(14,1,'ADMINISTRATOR','/accounts-receivable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(15,1,'ADMINISTRATOR','/cash-bank',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(16,1,'ADMINISTRATOR','/general-journal',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(17,1,'ADMINISTRATOR','/chart-of-accounts',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(18,1,'ADMINISTRATOR','/financial-reports',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(19,1,'ADMINISTRATOR','/fixed-assets',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(20,1,'ADMINISTRATOR','/budgeting',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(21,1,'ADMINISTRATOR','/tax-management',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(22,1,'ADMINISTRATOR','/period-closing',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(23,1,'ADMINISTRATOR','/suppliers-customers',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(24,1,'ADMINISTRATOR','/products',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(25,1,'ADMINISTRATOR','/super-admin/tenants',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(26,1,'ADMINISTRATOR','/users',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(27,1,'ADMIN_GUDANG','/',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(28,1,'ADMIN_GUDANG','/sales-quotations',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(29,1,'ADMIN_GUDANG','/purchase-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(30,1,'ADMIN_GUDANG','/sales-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(31,1,'ADMIN_GUDANG','/delivery-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(32,1,'ADMIN_GUDANG','/returns',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(33,1,'ADMIN_GUDANG','/inbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(34,1,'ADMIN_GUDANG','/outbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(35,1,'ADMIN_GUDANG','/stock-adjustment',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(36,1,'ADMIN_GUDANG','/batch-lots',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(37,1,'ADMIN_GUDANG','/warehouses',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(38,1,'ADMIN_GUDANG','/stock-card',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(39,1,'ADMIN_GUDANG','/accounts-payable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(40,1,'ADMIN_GUDANG','/accounts-receivable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(41,1,'ADMIN_GUDANG','/cash-bank',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(42,1,'ADMIN_GUDANG','/general-journal',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(43,1,'ADMIN_GUDANG','/chart-of-accounts',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(44,1,'ADMIN_GUDANG','/financial-reports',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(45,1,'ADMIN_GUDANG','/fixed-assets',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(46,1,'ADMIN_GUDANG','/budgeting',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(47,1,'ADMIN_GUDANG','/tax-management',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(48,1,'ADMIN_GUDANG','/period-closing',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(49,1,'ADMIN_GUDANG','/suppliers-customers',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(50,1,'ADMIN_GUDANG','/products',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(51,1,'ADMIN_GUDANG','/super-admin/tenants',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(52,1,'ADMIN_GUDANG','/users',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(53,1,'ADMIN_KEUANGAN','/',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(54,1,'ADMIN_KEUANGAN','/sales-quotations',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(55,1,'ADMIN_KEUANGAN','/purchase-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(56,1,'ADMIN_KEUANGAN','/sales-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(57,1,'ADMIN_KEUANGAN','/delivery-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(58,1,'ADMIN_KEUANGAN','/returns',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(59,1,'ADMIN_KEUANGAN','/inbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(60,1,'ADMIN_KEUANGAN','/outbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(61,1,'ADMIN_KEUANGAN','/stock-adjustment',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(62,1,'ADMIN_KEUANGAN','/batch-lots',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(63,1,'ADMIN_KEUANGAN','/warehouses',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(64,1,'ADMIN_KEUANGAN','/stock-card',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(65,1,'ADMIN_KEUANGAN','/accounts-payable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(66,1,'ADMIN_KEUANGAN','/accounts-receivable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(67,1,'ADMIN_KEUANGAN','/cash-bank',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(68,1,'ADMIN_KEUANGAN','/general-journal',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(69,1,'ADMIN_KEUANGAN','/chart-of-accounts',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(70,1,'ADMIN_KEUANGAN','/financial-reports',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(71,1,'ADMIN_KEUANGAN','/fixed-assets',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(72,1,'ADMIN_KEUANGAN','/budgeting',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(73,1,'ADMIN_KEUANGAN','/tax-management',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(74,1,'ADMIN_KEUANGAN','/period-closing',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(75,1,'ADMIN_KEUANGAN','/suppliers-customers',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(76,1,'ADMIN_KEUANGAN','/products',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(77,1,'ADMIN_KEUANGAN','/super-admin/tenants',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(78,1,'ADMIN_KEUANGAN','/users',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(79,1,'ADMIN_OPERASIONAL','/',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(80,1,'ADMIN_OPERASIONAL','/sales-quotations',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(81,1,'ADMIN_OPERASIONAL','/purchase-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(82,1,'ADMIN_OPERASIONAL','/sales-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(83,1,'ADMIN_OPERASIONAL','/delivery-orders',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(84,1,'ADMIN_OPERASIONAL','/returns',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(85,1,'ADMIN_OPERASIONAL','/inbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(86,1,'ADMIN_OPERASIONAL','/outbound',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(87,1,'ADMIN_OPERASIONAL','/stock-adjustment',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(88,1,'ADMIN_OPERASIONAL','/batch-lots',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(89,1,'ADMIN_OPERASIONAL','/warehouses',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(90,1,'ADMIN_OPERASIONAL','/stock-card',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(91,1,'ADMIN_OPERASIONAL','/accounts-payable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(92,1,'ADMIN_OPERASIONAL','/accounts-receivable',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(93,1,'ADMIN_OPERASIONAL','/cash-bank',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(94,1,'ADMIN_OPERASIONAL','/general-journal',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(95,1,'ADMIN_OPERASIONAL','/chart-of-accounts',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(96,1,'ADMIN_OPERASIONAL','/financial-reports',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(97,1,'ADMIN_OPERASIONAL','/fixed-assets',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(98,1,'ADMIN_OPERASIONAL','/budgeting',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(99,1,'ADMIN_OPERASIONAL','/tax-management',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(100,1,'ADMIN_OPERASIONAL','/period-closing',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(101,1,'ADMIN_OPERASIONAL','/suppliers-customers',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(102,1,'ADMIN_OPERASIONAL','/products',1,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(103,1,'ADMIN_OPERASIONAL','/super-admin/tenants',0,'2026-10-09 13:36:28','2026-10-09 13:36:28'),(104,1,'ADMIN_OPERASIONAL','/users',1,'2026-10-09 13:36:28','2026-10-09 13:36:28');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_order_details`
--

DROP TABLE IF EXISTS `sales_order_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_order_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `so_id` int NOT NULL,
  `kode_produk` varchar(50) NOT NULL,
  `qty_pesanan` int NOT NULL,
  `harga_satuan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `diskon` decimal(15,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `qty_terkirim` int DEFAULT '0',
  `satuan_order` varchar(20) DEFAULT 'PCS',
  `qty_order` decimal(10,2) DEFAULT NULL,
  `rasio_pcs` decimal(10,2) DEFAULT '1.00',
  PRIMARY KEY (`id`),
  KEY `so_id` (`so_id`),
  KEY `kode_produk` (`kode_produk`),
  CONSTRAINT `sales_order_details_ibfk_1` FOREIGN KEY (`so_id`) REFERENCES `sales_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_order_details`
--

LOCK TABLES `sales_order_details` WRITE;
/*!40000 ALTER TABLE `sales_order_details` DISABLE KEYS */;
INSERT INTO `sales_order_details` VALUES (1,12,12,'PRD-004',2,68500.00,0.00,137000.00,2,'PCS',NULL,1.00);
/*!40000 ALTER TABLE `sales_order_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_orders`
--

DROP TABLE IF EXISTS `sales_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_orders` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_so` varchar(50) NOT NULL,
  `customer_id` int DEFAULT NULL,
  `tanggal_so` date NOT NULL,
  `termin_hari` int NOT NULL DEFAULT '30',
  `jatuh_tempo` date DEFAULT NULL,
  `status` enum('OPEN','PROCESSING','CLOSED','CANCELLED') DEFAULT 'OPEN',
  `keterangan` text,
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `diskon_persen` decimal(5,2) NOT NULL DEFAULT '0.00',
  `diskon_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `pajak_persen` decimal(5,2) NOT NULL DEFAULT '0.00',
  `pajak_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_harga` decimal(15,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_so_tenant` (`tenant_id`,`no_so`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `sales_orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_orders`
--

LOCK TABLES `sales_orders` WRITE;
/*!40000 ALTER TABLE `sales_orders` DISABLE KEYS */;
INSERT INTO `sales_orders` VALUES (3,5,'SO/2026/10/7854',2,'2026-10-08',30,'2026-11-07','OPEN','TS',60000.00,0.00,0.00,11.00,6600.00,66600.00,'2026-10-08 08:23:51'),(1,12,'SO/2026/10/1006',1,'2026-10-13',30,'2026-11-12','PROCESSING',NULL,137000.00,0.00,0.00,11.00,15070.00,152070.00,'2026-10-13 08:38:58');
/*!40000 ALTER TABLE `sales_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_quotation_details`
--

DROP TABLE IF EXISTS `sales_quotation_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_quotation_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `quotation_id` int NOT NULL,
  `product_id` int NOT NULL,
  `qty` int NOT NULL,
  `harga_satuan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `diskon_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `catatan` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `satuan_order` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'PCS',
  `qty_order` decimal(10,2) DEFAULT NULL,
  `rasio_pcs` decimal(10,2) DEFAULT '1.00',
  PRIMARY KEY (`id`),
  KEY `idx_sqd_quotation` (`quotation_id`),
  KEY `idx_sqd_product` (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_quotation_details`
--

LOCK TABLES `sales_quotation_details` WRITE;
/*!40000 ALTER TABLE `sales_quotation_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_quotation_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_quotations`
--

DROP TABLE IF EXISTS `sales_quotations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_quotations` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_quotation` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` int NOT NULL,
  `tanggal` date NOT NULL,
  `berlaku_sampai` date NOT NULL,
  `termin_pembayaran` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'NET 30',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `diskon_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `pajak_persen` decimal(5,2) NOT NULL DEFAULT '11.00',
  `pajak_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `grand_total` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` enum('DRAFT','SENT','ACCEPTED','REJECTED','CONVERTED_TO_SO') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'DRAFT',
  `so_id` int DEFAULT NULL,
  `catatan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_quotation_tenant` (`tenant_id`,`no_quotation`),
  KEY `idx_sq_customer` (`customer_id`),
  KEY `idx_sq_tanggal` (`tanggal`),
  KEY `idx_sq_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_quotations`
--

LOCK TABLES `sales_quotations` WRITE;
/*!40000 ALTER TABLE `sales_quotations` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_quotations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_return_details`
--

DROP TABLE IF EXISTS `sales_return_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_return_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `return_id` int NOT NULL,
  `product_id` int NOT NULL,
  `qty` int NOT NULL,
  `harga_satuan` decimal(15,2) NOT NULL DEFAULT '0.00',
  `subtotal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `catatan` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_srd_return` (`return_id`),
  KEY `idx_srd_product` (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_return_details`
--

LOCK TABLES `sales_return_details` WRITE;
/*!40000 ALTER TABLE `sales_return_details` DISABLE KEYS */;
INSERT INTO `sales_return_details` VALUES (1,2,2,4,2,68500.00,137000.00,'penok');
/*!40000 ALTER TABLE `sales_return_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_returns`
--

DROP TABLE IF EXISTS `sales_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_returns` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_return` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `so_id` int DEFAULT NULL,
  `customer_id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `tanggal` date NOT NULL,
  `total_nominal` decimal(15,2) NOT NULL DEFAULT '0.00',
  `alasan_retur` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `tipe_penyelesaian` enum('POTONG_PIUTANG','PENGEMBALIAN_KAS','GANTI_BARANG') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'POTONG_PIUTANG',
  `kembali_ke_stok` tinyint(1) DEFAULT '1',
  `status` enum('COMPLETED','DRAFT','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'COMPLETED',
  `journal_id` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_return_tenant` (`tenant_id`,`no_return`),
  KEY `idx_sr_customer` (`customer_id`),
  KEY `idx_sr_tanggal` (`tanggal`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_returns`
--

LOCK TABLES `sales_returns` WRITE;
/*!40000 ALTER TABLE `sales_returns` DISABLE KEYS */;
INSERT INTO `sales_returns` VALUES (1,2,'SR-202610-8521',NULL,1,1,'2026-10-13',137000.00,'penok','POTONG_PIUTANG',1,'COMPLETED',45,1,'2026-10-13 08:54:28');
/*!40000 ALTER TABLE `sales_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustment_details`
--

DROP TABLE IF EXISTS `stock_adjustment_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustment_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `adjustment_id` int NOT NULL,
  `product_id` int NOT NULL,
  `stok_sistem` int NOT NULL,
  `stok_fisik` int NOT NULL,
  `selisih_qty` int NOT NULL,
  `harga_satuan` decimal(15,2) DEFAULT '0.00',
  `selisih_nominal` decimal(15,2) DEFAULT '0.00',
  `catatan` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_adjd_adj` (`adjustment_id`),
  KEY `idx_adjd_product` (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustment_details`
--

LOCK TABLES `stock_adjustment_details` WRITE;
/*!40000 ALTER TABLE `stock_adjustment_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_adjustment_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustments`
--

DROP TABLE IF EXISTS `stock_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustments` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_adjustment` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `warehouse_id` int NOT NULL,
  `tanggal` date NOT NULL,
  `tipe_adjustment` enum('OPNAME_FISIK','RUSAK_KEDALUWARSA','SELISIH_HILANG','KOREKSI_TAMBAH') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('APPROVED','DRAFT','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'APPROVED',
  `total_selisih_nominal` decimal(15,2) DEFAULT '0.00',
  `journal_id` int DEFAULT NULL,
  `catatan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_adj_tenant` (`tenant_id`,`no_adjustment`),
  KEY `idx_adj_wh` (`warehouse_id`),
  KEY `idx_adj_tanggal` (`tanggal`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustments`
--

LOCK TABLES `stock_adjustments` WRITE;
/*!40000 ALTER TABLE `stock_adjustments` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_adjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_mutations`
--

DROP TABLE IF EXISTS `stock_mutations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_mutations` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `tanggal_mutasi` datetime NOT NULL,
  `kode_produk` varchar(50) NOT NULL,
  `nomor_lot` varchar(100) NOT NULL,
  `warehouse_id` int DEFAULT NULL,
  `tipe` varchar(50) NOT NULL,
  `qty_perubahan` int NOT NULL,
  `qty_sisa` int NOT NULL,
  `referensi` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_mutations`
--

LOCK TABLES `stock_mutations` WRITE;
/*!40000 ALTER TABLE `stock_mutations` DISABLE KEYS */;
INSERT INTO `stock_mutations` VALUES (1,25,'2026-10-13 15:13:37','PRD-004','PRD0-261013-568',1,'MASUK',300,300,'PO-212122221','2026-10-13 08:13:37'),(1,30,'2026-10-13 15:39:28','PRD-004','LOT-SSU-2601',1,'KELUAR',2,118,'DO/2026/10/4074','2026-10-13 08:39:28'),(1,32,'2026-10-13 15:54:28','PRD-004','PRD0-261013-568',1,'RETUR_JUAL',2,302,'SR-202610-8521','2026-10-13 08:54:28');
/*!40000 ALTER TABLE `stock_mutations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_supplier` varchar(50) NOT NULL,
  `nama_supplier` varchar(150) NOT NULL,
  `telepon` varchar(30) DEFAULT NULL,
  `alamat` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supplier_tenant` (`tenant_id`,`kode_supplier`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (1,1,'SUP-001','PT. ABADI JAYA','0','TEST','2026-10-06 10:09:26'),(3,3,'SUP-001','PT ABADI MEDICAL','0','TEST','2026-10-08 08:20:46'),(3,4,'SUP-002','PT ARKANMEDICAL','0','TEST','2026-10-09 07:14:12');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_records`
--

DROP TABLE IF EXISTS `tax_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_records` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_transaksi` varchar(50) NOT NULL,
  `tipe_pajak` enum('PPN_MASUKAN','PPN_KELUARAN','PPH_21','PPH_23','PPH_4_2') NOT NULL,
  `tanggal` date NOT NULL,
  `no_faktur_pajak` varchar(50) DEFAULT NULL,
  `pihak_terkait` varchar(150) NOT NULL,
  `dpp` decimal(15,2) NOT NULL DEFAULT '0.00',
  `tarif_persen` decimal(5,2) NOT NULL DEFAULT '11.00',
  `nominal_pajak` decimal(15,2) NOT NULL DEFAULT '0.00',
  `referensi` varchar(100) DEFAULT NULL,
  `status_spt` enum('BELUM_LAPOR','SIAP_LAPOR','SUDAH_LAPOR') NOT NULL DEFAULT 'BELUM_LAPOR',
  `journal_id` int DEFAULT NULL,
  `catatan` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tax_rec_tenant` (`tenant_id`,`no_transaksi`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `tax_records_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_records`
--

LOCK TABLES `tax_records` WRITE;
/*!40000 ALTER TABLE `tax_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `tax_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenant_modules`
--

DROP TABLE IF EXISTS `tenant_modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenant_modules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `kode_modul` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_module` (`tenant_id`,`kode_modul`),
  CONSTRAINT `tenant_modules_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenant_modules`
--

LOCK TABLES `tenant_modules` WRITE;
/*!40000 ALTER TABLE `tenant_modules` DISABLE KEYS */;
INSERT INTO `tenant_modules` VALUES (1,1,'MOD_INVENTORY',1,'2026-10-07 04:06:11'),(2,1,'MOD_COMMERCIAL',1,'2026-10-07 04:06:11'),(3,1,'MOD_ACCOUNTING',1,'2026-10-07 04:06:11'),(7,3,'MOD_INVENTORY',1,'2026-10-07 08:46:23'),(8,3,'MOD_COMMERCIAL',1,'2026-10-07 08:46:23'),(9,3,'MOD_ACCOUNTING',1,'2026-10-07 08:46:23');
/*!40000 ALTER TABLE `tenant_modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tenants`
--

DROP TABLE IF EXISTS `tenants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tenants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_tenant` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_perusahaan` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_pemilik` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `telepon` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('TRIAL','ACTIVE','EXPIRED','SUSPENDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `expired_at` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode_tenant` (`kode_tenant`),
  UNIQUE KEY `email_pemilik` (`email_pemilik`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tenants`
--

LOCK TABLES `tenants` WRITE;
/*!40000 ALTER TABLE `tenants` DISABLE KEYS */;
INSERT INTO `tenants` VALUES (1,'TENANT-001','PT JARUM PATAH MEDICAL','admin@jarumpatah.co.id','021-8983011','ACTIVE','2030-12-31','2026-10-07 04:06:11'),(3,'TENANT-288','PT BERNANDO MEDIKA','kurniawan@gmail.com','0','ACTIVE','2027-10-07','2026-10-07 08:46:23');
/*!40000 ALTER TABLE `tenants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaction_details`
--

DROP TABLE IF EXISTS `transaction_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaction_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_id` int NOT NULL,
  `nomor_lot` varchar(100) NOT NULL,
  `qty` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `transaction_id` (`transaction_id`),
  KEY `nomor_lot` (`nomor_lot`),
  CONSTRAINT `transaction_details_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaction_details`
--

LOCK TABLES `transaction_details` WRITE;
/*!40000 ALTER TABLE `transaction_details` DISABLE KEYS */;
INSERT INTO `transaction_details` VALUES (1,13,12,'PRD0-261013-568',300),(1,18,17,'LOT-SSU-2601',2);
/*!40000 ALTER TABLE `transaction_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_transaksi` varchar(50) NOT NULL,
  `tipe_transaksi` enum('MASUK','KELUAR') NOT NULL,
  `referensi` varchar(100) DEFAULT NULL,
  `tanggal_transaksi` datetime NOT NULL,
  `keterangan` text,
  `user_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `purchase_order_id` int DEFAULT NULL,
  `delivery_order_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trans_tenant` (`tenant_id`,`kode_transaksi`),
  KEY `fk_user_transaction` (`user_id`),
  KEY `fk_trans_po` (`purchase_order_id`),
  KEY `fk_trans_do` (`delivery_order_id`),
  CONSTRAINT `fk_trans_do` FOREIGN KEY (`delivery_order_id`) REFERENCES `delivery_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_trans_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_transaction` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES (1,12,'IN-20261013-JPTR','MASUK','PO-212122221','2026-10-13 15:13:37',NULL,1,1,4,NULL,'2026-10-13 08:13:37'),(1,17,'OUT-20261013-STAH','KELUAR','DO/2026/10/4074','2026-10-13 15:39:28','Pengiriman DO DO/2026/10/4074 (SO: SO/2026/10/1006)',1,1,NULL,10,'2026-10-13 08:39:28');
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `nama_lengkap` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'ADMINISTRATOR',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'Kurniawan Saepudin','admin','$2b$10$sqzNUQsxv9veySFCiBj8CuFL.4ywnu2stseYWz0CyNPAJmZ8Tdxa6','PENGEMBANG','2026-10-12 02:29:50'),(1,2,'Budi Santoso','gudang01','$2b$10$P0F4zZ0J9iP7/2Hf6EpbceWs1FrXk.aNzNweDU/oyVpQTybzRVziS','ADMIN_GUDANG','2026-10-12 02:29:50');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouse_transfer_details`
--

DROP TABLE IF EXISTS `warehouse_transfer_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouse_transfer_details` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `transfer_id` int NOT NULL,
  `product_id` int NOT NULL,
  `qty` int NOT NULL,
  `catatan` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wtd_transfer` (`transfer_id`),
  KEY `idx_wtd_product` (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouse_transfer_details`
--

LOCK TABLES `warehouse_transfer_details` WRITE;
/*!40000 ALTER TABLE `warehouse_transfer_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouse_transfer_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouse_transfers`
--

DROP TABLE IF EXISTS `warehouse_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouse_transfers` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `no_transfer` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_warehouse_id` int NOT NULL,
  `to_warehouse_id` int NOT NULL,
  `tanggal` date NOT NULL,
  `status` enum('DRAFT','COMPLETED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'COMPLETED',
  `catatan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_trf_tenant` (`tenant_id`,`no_transfer`),
  KEY `idx_wt_from` (`from_warehouse_id`),
  KEY `idx_wt_to` (`to_warehouse_id`),
  KEY `idx_wt_tanggal` (`tanggal`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouse_transfers`
--

LOCK TABLES `warehouse_transfers` WRITE;
/*!40000 ALTER TABLE `warehouse_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouse_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
  `tenant_id` int NOT NULL DEFAULT '1',
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_gudang` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_gudang` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipe_gudang` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'UTAMA',
  `alamat` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `penanggung_jawab` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telepon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouse_tenant` (`tenant_id`,`kode_gudang`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES (1,1,'GDG-01','Gudang Pusat Logistik & Alkes','UTAMA','Kawasan Industri Cikarang Blok B-12','Budi Santoso, S.T.','021-8983011',1,'2026-10-07 02:58:43'),(1,2,'GDG-02','Gudang Distribusi Farmasi & Obat','FARMASI','Kawasan Industri Cikarang Blok B-14','Apt. Siti Rahma, S.Farm','021-8983012',1,'2026-10-07 02:58:43'),(1,3,'GDG-03','Gudang Karantina & Retur Medis','KARANTINA','Kawasan Industri Cikarang Blok C-01','Hendra Wijaya','021-8983015',1,'2026-10-07 02:58:43'),(1,4,'GDG-04','Gudang Cabang Rumah Sakit Surabaya','CABANG','Jl. Mayjen Sungkono No. 88, Surabaya','dr. Anton Pratama','031-5678901',1,'2026-10-07 02:58:43'),(2,7,'GDG-01','Gudang Utama Bernando Medika','UTAMA',NULL,NULL,NULL,1,'2026-10-08 07:54:53'),(3,8,'GDG-01','GUDANG BOGOR','UTAMA','TEST','AWAN',NULL,1,'2026-10-08 07:56:07');
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-23 18:08:08
