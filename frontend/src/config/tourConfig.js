/**
 * Konfigurasi Panduan Tur Interaktif (Tour Guide) untuk Seluruh Modul SyntesiaERP
 * Setiap modul memiliki tahapan langkah pengisian, penjelasan fitur, tips operasional,
 * dan targetType untuk menyorot elemen UI nyata pada halaman tersebut.
 *
 * targetType yang didukung:
 * - 'banner' : Menyorot banner header modul di bagian atas
 * - 'action' : Menyorot tombol aksi utama (Tambah, Buat Baru, Scan)
 * - 'filter' : Menyorot kolom pencarian dan filter data
 * - 'table'  : Menyorot tabel data / daftar transaksi
 * - 'export' : Menyorot tombol export excel / cetak PDF
 * - 'sop'    : Menyorot tombol Panduan SOP di navbar
 */

export const MODULE_TOURS = {
  // 1. DASHBOARD UTAMA
  '/': {
    moduleName: 'Dashboard Utama',
    steps: [
      {
        id: 'dash-welcome',
        targetId: 'tour-welcome',
        targetType: 'banner',
        title: 'Selamat Datang di SyntesiaERP! 👋',
        content: 'Dashboard ini merupakan pusat kendali seluruh aktivitas operasional bisnis, pergudangan, alur pesanan, dan keuangan perusahaan Anda.',
        tip: 'Wewenang menu otomatis menyesuaikan dengan peran (role) akun yang sedang aktif.',
      },
      {
        id: 'dash-quick-actions',
        targetId: 'tour-quick-actions',
        targetType: 'action',
        title: 'Pintasan Input Cepat ⚡',
        content: 'Gunakan tombol aksi cepat ini untuk langsung membuat transaksi baru: input Master Produk, scan Barang Masuk, buat Delivery Order, atau catat Jurnal Umum tanpa perlu mencari menu di sidebar.',
        tip: 'Klik salah satu tombol untuk langsung menuju ke form transaksi terkait.',
      },
      {
        id: 'dash-kpi',
        targetId: 'tour-kpi-summary',
        targetType: 'table',
        title: 'Ringkasan Realtime & Status Stok 📊',
        content: 'Pantau jumlah produk aktif, total stok fisik gudang, mutasi barang hari ini, serta saldo likuiditas Kas & Bank dan posisi laba rugi perusahaan secara seketika.',
        tip: 'Stok fisik & HPP otomatis terpotong saat Delivery Order (DO) divalidasi, dan bertambah saat barang masuk (Inbound) diterima.',
      },
      {
        id: 'dash-sidebar',
        targetId: 'tour-sidebar-toggle',
        targetType: 'sidebar',
        title: 'Navigasi Lengkap Seluruh Modul 🗂️',
        content: 'Sidebar kiri memuat seluruh alur kerja ERP terintegrasi: Gudang, Pembelian (PO), Penjualan (SO & DO), Keuangan (AP, AR, Kas/Bank), Akuntansi, dan Pengaturan Master.',
        tip: 'Klik tombol di samping logo ini untuk melipat atau memperluas sidebar agar area kerja Anda lebih leluasa.',
      },
      {
        id: 'dash-notif',
        targetId: 'tour-notifications',
        targetType: 'notif',
        title: 'Peringatan & Pengingat Otomatis 🔔',
        content: 'Sistem otomatis mendeteksi dan memberi notifikasi jika ada barang yang stoknya menipis/habis, serta tagihan utang (AP) atau piutang (AR) yang mendekati atau telah lewat jatuh tempo.',
        tip: 'Klik notifikasi untuk langsung membuka halaman tagihan atau lot produk terkait.',
      },
      {
        id: 'dash-sop',
        targetId: 'tour-sop-guide',
        targetType: 'sop',
        title: 'Buku Panduan SOP & Alur Kerja 📖',
        content: 'Klik tombol ini kapan saja untuk membaca alur kerja baku setiap modul, diagram alur transaksi, dan integrasi akuntansi otomatisnya.',
        tip: 'Cocok sebagai pedoman operasional dan panduan training untuk staf baru.',
      },
    ],
  },

  // 2. BUKU PANDUAN SOP
  '/workflows': {
    moduleName: 'Panduan SOP Alur Kerja',
    steps: [
      {
        id: 'sop-intro',
        targetType: 'banner',
        title: 'Buku Pedoman Operasional & SOP ERP 📖',
        content: 'Halaman ini menyajikan Standard Operating Procedure (SOP) baku untuk setiap modul operasional di SyntesiaERP dalam bentuk diagram alur interaktif.',
        tip: 'Gunakan panduan ini untuk memastikan transaksi diinput sesuai tahapan yang benar.',
      },
      {
        id: 'sop-filters',
        targetType: 'filter',
        title: 'Pencarian & Filter Alur Modul 🔍',
        content: 'Anda dapat mencari alur tertentu atau memfilter modul: Gudang, Pembelian, Penjualan, Keuangan, atau Akuntansi.',
        tip: 'Gunakan tombol "Tutup Semua / Buka Semua" untuk merapikan tampilan panduan.',
      },
      {
        id: 'sop-flowchart',
        targetType: 'table',
        title: 'Diagram Alur & Decision Tree 🔄',
        content: 'Setiap modul dilengkapi diagram alur langkah demi langkah serta percabangan keputusan (misal: kondisi stok cukup vs kurang, approval kredit customer, dsb).',
        tip: 'Diagram ini menggambarkan alur kerja fisik di lapangan dan alur kerja di dalam aplikasi.',
      },
      {
        id: 'sop-accounting',
        targetType: 'export',
        title: 'Otomasi Double-Entry Ledger Akuntansi ⚖️',
        content: 'Bagian bawah setiap modul menjelaskan jurnal akuntansi otomatis yang dibentuk sistem (Debit & Kredit) tanpa perlu diinput manual oleh staf gudang/sales.',
        tip: 'Sistem menjamin neraca dan laporan laba rugi selalu seimbang (balance) secara realtime.',
      },
    ],
  },

  // 3. BARANG MASUK (INBOUND)
  '/inbound': {
    moduleName: 'Barang Masuk (Inbound)',
    steps: [
      {
        id: 'inbound-intro',
        targetType: 'banner',
        title: 'Modul Penerimaan Barang Masuk (Inbound) 📥',
        content: 'Gunakan modul ini saat barang fisik tiba di gudang dari supplier (pembelian PO), retur customer, atau transfer antar gudang.',
        tip: 'Penerimaan barang akan otomatis menambah stok fisik dan memperbarui kartu stok.',
      },
      {
        id: 'inbound-scan',
        targetType: 'action',
        title: 'Scan Barcode / Input SKU Cepat ⚡',
        content: 'Arahkan barcode scanner fisik ke barcode produk atau kemasan kardus. Sistem akan otomatis mengisi nama produk dan satuan.',
        tip: 'Jika tidak ada scanner, Anda bisa memilih produk secara manual dari daftar pencarian.',
      },
      {
        id: 'inbound-po',
        targetType: 'filter',
        title: 'Hubungkan dengan Purchase Order (PO) 📋',
        content: 'Pilih nomor PO terkait agar sistem memvalidasi sisa kuantitas pesanan yang belum diterima dari supplier.',
        tip: 'Membantu mencegah penerimaan barang berlebih dari yang dipesan.',
      },
      {
        id: 'inbound-table',
        targetType: 'table',
        title: 'Riwayat Penerimaan & Nomor Lot 🏷️',
        content: 'Semua penerimaan barang tercatat lengkap dengan Nomor Lot / Batch, Tanggal Kedaluwarsa (Expired Date), Shift kerja, dan Nama Petugas.',
        tip: 'Gunakan data ini untuk penelusuran mutu barang jika ada kendala di kemudian hari.',
      },
      {
        id: 'inbound-sop',
        targetType: 'sop',
        title: 'SOP & Otomasi Akuntansi Barang Masuk ⚖️',
        content: 'Saat barang masuk divalidasi, sistem otomatis mencatat penambahan kuantitas pada Kartu Stok dan menyiapkan alur pencocokan faktur tagihan supplier.',
        tip: 'Klik tombol Panduan SOP di navbar kapan saja untuk melihat diagram alur lengkapnya.',
      },
    ],
  },

  // 4. BARANG KELUAR (OUTBOUND)
  '/outbound': {
    moduleName: 'Barang Keluar (Outbound)',
    steps: [
      {
        id: 'outbound-intro',
        targetType: 'banner',
        title: 'Modul Pengeluaran Barang (Outbound) 📤',
        content: 'Digunakan untuk mencatat barang yang keluar dari gudang: pengiriman penjualan (DO), pemakaian operasional, atau retur ke supplier.',
        tip: 'Barang keluar memotong stok fisik gudang dan mencatat mutasi pada kartu stok.',
      },
      {
        id: 'outbound-scan',
        targetType: 'action',
        title: 'Pilih Produk & Lot yang Dikeluarkan 🔍',
        content: 'Scan barcode atau pilih produk. Sistem akan menampilkan daftar lot yang tersedia beserta tanggal expired-nya.',
        tip: 'Gunakan aturan FEFO (First Expired First Out) untuk memprioritaskan lot dengan tanggal kedaluwarsa terdekat.',
      },
      {
        id: 'outbound-filter',
        targetType: 'filter',
        title: 'Referensi Delivery Order (DO) / Surat Jalan 🚚',
        content: 'Untuk penjualan, pastikan menghubungkan pengeluaran barang dengan nomor Delivery Order (DO) agar status pengiriman terupdate.',
        tip: 'Sistem mencegah pengeluaran barang melebihi kuantitas yang tertera di DO.',
      },
      {
        id: 'outbound-table',
        targetType: 'table',
        title: 'Riwayat Mutasi & Dokumen Keluar 📄',
        content: 'Semua transaksi barang keluar tercatat lengkap dengan waktu, nama staf, nomor lot, dan keterangan tujuan.',
        tip: 'Data dapat difilter berdasarkan rentang tanggal dan diekspor ke Excel.',
      },
    ],
  },

  // 5. PURCHASE ORDERS (PO)
  '/purchase-orders': {
    moduleName: 'Purchase Orders (PO)',
    steps: [
      {
        id: 'po-intro',
        targetType: 'banner',
        title: 'Modul Pengadaan & Purchase Order (PO) 🛒',
        content: 'Tempat membuat pesanan pembelian resmi kepada supplier untuk pengadaan bahan baku atau barang dagangan.',
        tip: 'PO berfungsi sebagai bukti komitmen pesanan dan dasar verifikasi saat barang masuk di gudang.',
      },
      {
        id: 'po-create',
        targetType: 'action',
        title: 'Tombol Buat PO Baru ➕',
        content: 'Klik tombol "Buat PO Baru" untuk membuka formulir pemesanan barang ke supplier.',
        tip: 'Nomor PO dapat di-generate otomatis oleh sistem atau diisi nomor faktur manual.',
      },
      {
        id: 'po-filters',
        targetType: 'filter',
        title: 'Pencarian & Filter Status PO 🔍',
        content: 'Gunakan kolom pencarian untuk mencari No. PO atau nama supplier, serta filter status: PENDING, APPROVED, COMPLETED, atau CANCELLED.',
        tip: 'Memudahkan memantau pesanan yang belum dikirim oleh supplier.',
      },
      {
        id: 'po-table',
        targetType: 'table',
        title: 'Daftar PO & Rincian Tagihan 📋',
        content: 'Tabel menampilkan No. PO, Supplier, Tanggal PO, Jatuh Tempo, Nilai Tagihan, dan Status Pembayaran Utang.',
        tip: 'Klik tombol mata (Detail) untuk melihat rincian item produk yang dipesan.',
      },
      {
        id: 'po-print',
        targetType: 'export',
        title: 'Cetak Dokumen PO & Export Excel 🖨️',
        content: 'Gunakan tombol Cetak PO untuk menghasilkan file PDF resmi lengkap dengan logo dan tanda tangan, atau ekspor rekap ke Excel.',
        tip: 'Gunakan tombol Kustomisasi untuk menyesuaikan nama pejabat penandatangan dan kop perusahaan.',
      },
    ],
  },

  // 6. SALES ORDERS (SO)
  '/sales-orders': {
    moduleName: 'Sales Orders (SO)',
    steps: [
      {
        id: 'so-intro',
        targetType: 'banner',
        title: 'Modul Pesanan Penjualan (Sales Order) 🛍️',
        content: 'Mencatat pesanan resmi dari customer sebelum barang dikirim dan ditagih.',
        tip: 'Sales Order TIDAK langsung memotong stok fisik gudang. Stok baru terpotong saat Delivery Order (DO) divalidasi.',
      },
      {
        id: 'so-create',
        targetType: 'action',
        title: 'Buat Sales Order Baru ➕',
        content: 'Klik tombol "Buat SO Baru" untuk menginput pesanan customer yang masuk dari sales / marketplace.',
        tip: 'SO juga bisa dibuat otomatis dari modul Penawaran Harga (Sales Quotation).',
      },
      {
        id: 'so-filters',
        targetType: 'filter',
        title: 'Pencarian No. SO & Nama Customer 🔍',
        content: 'Cari berdasarkan nomor pesanan SO atau nama pelanggan, serta filter status pesanan.',
        tip: 'Pantau pesanan yang berstatus APPROVED untuk segera diproses kirim oleh tim gudang.',
      },
      {
        id: 'so-table',
        targetType: 'table',
        title: 'Daftar Pesanan & Status Pengiriman 📦',
        content: 'Tabel memuat tanggal pesanan, customer, total nilai order, status persetujuan, dan progress pengiriman.',
        tip: 'Setelah SO disetujui, tombol Buat DO akan aktif untuk menerbitkan surat jalan pengiriman.',
      },
      {
        id: 'so-export',
        targetType: 'export',
        title: 'Cetak Invoice Penjualan & Export Excel 🖨️',
        content: 'Cetak faktur komersial (commercial invoice) untuk ditagihkan ke customer dan unduh laporan penjualan ke spreadsheet.',
        tip: 'Format invoice memuat rincian PPN 11% dan rekening bank pembayaran.',
      },
    ],
  },

  // 7. DELIVERY ORDERS (DO)
  '/delivery-orders': {
    moduleName: 'Delivery Orders (DO)',
    steps: [
      {
        id: 'do-intro',
        targetType: 'banner',
        title: 'Modul Surat Jalan Pengiriman (DO) 🚚',
        content: 'Dokumen legal pengiriman fisik barang dari gudang ke alamat pemesan (customer).',
        tip: 'Modul ini adalah titik integrasi utama pemotongan stok gudang dan pencatatan HPP.',
      },
      {
        id: 'do-create',
        targetType: 'action',
        title: 'Terbitkan Surat Jalan (DO) Baru ➕',
        content: 'Klik "Buat Delivery Order" dan pilih nomor Sales Order (SO) yang akan dikirimkan.',
        tip: 'Sistem akan otomatis memuat rincian item barang dan alamat tujuan dari SO.',
      },
      {
        id: 'do-filters',
        targetType: 'filter',
        title: 'Filter Pengiriman & Pencarian Resi 🔍',
        content: 'Filter berdasarkan status pengiriman: DRAFT, SHIPPED, atau DELIVERED.',
        tip: 'Gunakan pencarian untuk melacak nomor DO, nama ekspedisi, atau nama sopir.',
      },
      {
        id: 'do-table',
        targetType: 'table',
        title: 'Daftar Surat Jalan & Validasi Stok ⚖️',
        content: 'Saat status DO diubah menjadi "SHIPPED / TERKIRIM", sistem otomatis: 1) Memotong stok fisik gudang, 2) Mencatat mutasi keluar, 3) Memposting jurnal HPP (Debit HPP, Kredit Persediaan).',
        tip: 'Pastikan fisik barang sudah benar-benar dicek sebelum memvalidasi pengiriman.',
      },
      {
        id: 'do-export',
        targetType: 'export',
        title: 'Cetak Surat Jalan Resmi 🖨️',
        content: 'Cetak 3 rangkap surat jalan (untuk customer, ekspedisi/sopir, dan arsip gudang) dengan tombol Cetak DO.',
        tip: 'Format surat jalan memuat kolom tanda tangan penerima dan stempel pengirim.',
      },
    ],
  },

  // 8. ACCOUNTS PAYABLE (UTANG USAHA)
  '/accounts-payable': {
    moduleName: 'Utang Usaha (Accounts Payable)',
    steps: [
      {
        id: 'ap-intro',
        targetType: 'banner',
        title: 'Buku Pembantu Utang Usaha (AP) 💳',
        content: 'Memantau seluruh kewajiban pembayaran tagihan kepada supplier atas pembelian barang atau jasa secara kredit.',
        tip: 'Utang otomatis terbentuk setiap kali dokumen pembelian (PO) disetujui.',
      },
      {
        id: 'ap-action',
        targetType: 'action',
        title: 'Catat Pembayaran Tagihan Supplier 💰',
        content: 'Klik tombol "Bayar Tagihan" pada faktur yang akan dilunasi. Masukkan nominal pembayaran dan pilih akun Kas/Bank sumber dana.',
        tip: 'Mendukung pembayaran bertahap (cicilan). Sisa utang akan otomatis terhitung.',
      },
      {
        id: 'ap-filter',
        targetType: 'filter',
        title: 'Status Pembayaran & Jatuh Tempo ⏳',
        content: 'Pantau status faktur: BELUM BAYAR, SEBAGIAN, atau LUNAS. Faktur yang lewat tempo akan ditandai dengan badge merah.',
        tip: 'Notifikasi otomatis di navbar juga mengingatkan tagihan yang mendekati jatuh tempo.',
      },
      {
        id: 'ap-table',
        targetType: 'table',
        title: 'Daftar Tagihan & Riwayat Pelunasan 📋',
        content: 'Tabel menampilkan No. Faktur PO, Nama Supplier, Tanggal Jatuh Tempo, Nilai Tagihan, dan Sisa Utang.',
        tip: 'Setiap pembayaran otomatis memotong saldo rekening Kas/Bank yang dipilih.',
      },
      {
        id: 'ap-export',
        targetType: 'export',
        title: 'Rekap Utang & Export Excel 📊',
        content: 'Ekspor rekap jadwal pembayaran utang untuk menyusun anggaran kas mingguan perusahaan.',
        tip: 'Membantu menjaga hubungan baik dengan supplier dan menghindari denda keterlambatan.',
      },
    ],
  },

  // 9. ACCOUNTS RECEIVABLE (PIUTANG USAHA)
  '/accounts-receivable': {
    moduleName: 'Piutang Usaha (Accounts Receivable)',
    steps: [
      {
        id: 'ar-intro',
        targetType: 'banner',
        title: 'Buku Pembantu Piutang Usaha (AR) 💼',
        content: 'Memantau seluruh hak tagih pembayaran dari customer atas barang/jasa yang telah dikirimkan secara kredit.',
        tip: 'Membantu menjaga arus kas (cashflow) dan meminimalkan risiko piutang tak tertagih.',
      },
      {
        id: 'ar-action',
        targetType: 'action',
        title: 'Catat Penerimaan Pembayaran Customer 💵',
        content: 'Klik "Terima Pembayaran", masukkan nominal yang ditransfer oleh customer, dan pilih rekening Bank penerima.',
        tip: 'Dapat mencatat bukti transfer atau nomor referensi setoran bank.',
      },
      {
        id: 'ar-filter',
        targetType: 'filter',
        title: 'Monitoring Umur Piutang (Aging AR) 📅',
        content: 'Gunakan filter untuk melihat tagihan yang jatuh tempo hari ini, minggu ini, atau yang sudah menunggak lewat tempo.',
        tip: 'Prioritaskan follow-up penagihan ke customer dengan nilai tagihan terbesar.',
      },
      {
        id: 'ar-table',
        targetType: 'table',
        title: 'Daftar Piutang & Sisa Tagihan 📑',
        content: 'Tabel memuat daftar invoice penjualan, nama pelanggan, tanggal tempo, dan sisa saldo piutang.',
        tip: 'Saat pembayaran disimpan, sistem langsung mencatat jurnal: Debit Kas/Bank, Kredit Piutang.',
      },
      {
        id: 'ar-export',
        targetType: 'export',
        title: 'Cetak Kwitansi & Export Excel 🖨️',
        content: 'Cetak tanda terima kwitansi pembayaran untuk diserahkan ke customer dan ekspor rekap piutang ke Excel.',
        tip: 'Lengkap dengan kustomisasi kop perusahaan dan tanda tangan kasir/kolektor.',
      },
    ],
  },

  // 10. KAS & BANK
  '/cash-bank': {
    moduleName: 'Kas & Rekening Bank',
    steps: [
      {
        id: 'cash-intro',
        targetType: 'banner',
        title: 'Manajemen Kas & Rekening Bank 🏦',
        content: 'Kelola seluruh rekening likuiditas perusahaan: Kas Tunai/Petty Cash, Giro Operasional, dan Tabungan Bank.',
        tip: 'Seluruh saldo diupdate realtime setiap kali ada penerimaan atau pengeluaran dana.',
      },
      {
        id: 'cash-action',
        targetType: 'action',
        title: 'Catat Pemasukan / Pengeluaran Operasional 💸',
        content: 'Gunakan tombol "Catat Transaksi" untuk biaya operasional rutin (listrik, gaji, bensin, ATK) di luar transaksi pembelian PO/SO.',
        tip: 'Pilih akun biaya lawan pada COA agar laporan laba rugi langsung terupdate.',
      },
      {
        id: 'cash-filter',
        targetType: 'filter',
        title: 'Pilih Rekening & Filter Tanggal 🔍',
        content: 'Pilih rekening bank tertentu untuk melihat mutasi keluar-masuknya pada periode waktu tertentu.',
        tip: 'Memudahkan proses rekonsiliasi dengan rekening koran bulanan.',
      },
      {
        id: 'cash-table',
        targetType: 'table',
        title: 'Buku Kas & Riwayat Mutasi Dana 📑',
        content: 'Tabel menampilkan rincian debit (masuk), kredit (keluar), keterangan transaksi, dan saldo akhir berjalan.',
        tip: 'Saldo tidak dapat dimanipulasi manual karena terikat dengan jurnal akuntansi.',
      },
      {
        id: 'cash-export',
        targetType: 'export',
        title: 'Cetak Buku Kas Harian 🖨️',
        content: 'Cetak laporan kas harian/bulanan untuk ditandatangani oleh pemegang kas dan atasan keuangan.',
        tip: 'Dapat diekspor ke format Excel untuk kebutuhan arsip pembukuan.',
      },
    ],
  },

  // 11. GENERAL JOURNAL (JURNAL UMUM)
  '/general-journal': {
    moduleName: 'Jurnal Umum (General Journal)',
    steps: [
      {
        id: 'gj-intro',
        targetType: 'banner',
        title: 'Buku Jurnal Umum ERP (General Ledger) 📚',
        content: 'Pencatatan seluruh aktivitas keuangan perusahaan dalam sistem akuntansi berpasangan (Double-Entry Bookkeeping).',
        tip: 'Mayoritas jurnal dibuat otomatis oleh sistem saat transaksi gudang, PO, SO, dan kas dieksekusi.',
      },
      {
        id: 'gj-action',
        targetType: 'action',
        title: 'Buat Jurnal Penyesuaian Manual ✍️',
        content: 'Klik "Buat Jurnal Baru" untuk mencatat penyesuaian akhir bulan, penyusutan aset, atau koreksi akun.',
        tip: 'Total Debit dan Kredit HARUS SEIMBANG (Balance) agar sistem mengizinkan penyimpanan.',
      },
      {
        id: 'gj-filter',
        targetType: 'filter',
        title: 'Filter Sumber Transaksi & Tanggal 🔍',
        content: 'Saring jurnal berdasarkan tipe asal: MANUAL, PO (Beli), SO (Jual), OUTBOUND (HPP), AP_PAYMENT, AR_PAYMENT, dsb.',
        tip: 'Memudahkan penelusuran jika ada transaksi yang perlu diverifikasi.',
      },
      {
        id: 'gj-table',
        targetType: 'table',
        title: 'Daftar Jurnal Berpasangan (Debit & Kredit) ⚖️',
        content: 'Setiap voucher jurnal menampilkan kode akun, nama akun, posisi debit, kredit, dan nomor bukti referensi.',
        tip: 'Sistem menjamin keakuratan laporan laba rugi dan neraca saldo.',
      },
      {
        id: 'gj-export',
        targetType: 'export',
        title: 'Cetak Voucher Jurnal & Export Excel 🖨️',
        content: 'Cetak voucher jurnal resmi untuk ditandatangani oleh pembuat jurnal dan pemeriksa akuntansi.',
        tip: 'Format cetak mendukung kustomisasi logo dan kop surat perusahaan.',
      },
    ],
  },

  // 12. CHART OF ACCOUNTS (COA)
  '/chart-of-accounts': {
    moduleName: 'Bagan Akun (COA)',
    steps: [
      {
        id: 'coa-intro',
        targetType: 'banner',
        title: 'Master Bagan Akun Perkiraan (COA) 🗂️',
        content: 'Struktur kode akun akuntansi standar Indonesia: 1-Aset, 2-Kewajiban, 3-Ekuitas/Modal, 4-Pendapatan, 5-HPP, 6-Beban Operasional.',
        tip: 'Menjadi pondasi pembuatan seluruh laporan keuangan neraca dan laba rugi.',
      },
      {
        id: 'coa-action',
        targetType: 'action',
        title: 'Tambah & Edit Kode Akun ➕',
        content: 'Klik "Tambah Akun" untuk membuat rekening baru (contoh: 1-1002 Bank Mandiri, 6-1005 Biaya Promosi).',
        tip: 'Tentukan posisi saldo normal (Debit atau Kredit) dan kategori laporan.',
      },
      {
        id: 'coa-filter',
        targetType: 'filter',
        title: 'Pencarian Kode & Nama Akun 🔍',
        content: 'Gunakan kolom pencarian untuk menemukan akun berdasarkan kode nomor atau nama perkiraan.',
        tip: 'Dapat memfilter berdasarkan kategori: Aset Lancar, Kewajiban Jangka Pendek, Beban, dll.',
      },
      {
        id: 'coa-table',
        targetType: 'table',
        title: 'Daftar Hierarki Akun & Saldo Berjalan 📊',
        content: 'Tabel menampilkan seluruh struktur akun beserta saldo mutasi debit/kredit yang terhubung otomatis dengan jurnal.',
        tip: 'Akun sistem yang memiliki transaksi historis tidak boleh dihapus agar laporan tetap konsisten.',
      },
    ],
  },

  // 13. FINANCIAL REPORTS (LAPORAN KEUANGAN)
  '/financial-reports': {
    moduleName: 'Laporan Keuangan ERP',
    steps: [
      {
        id: 'rep-intro',
        targetType: 'banner',
        title: 'Modul Laporan Keuangan Eksekutif 📈',
        content: 'Menyajikan laporan keuangan lengkap dan akurat yang dihasilkan secara otomatis dari seluruh aktivitas transaksi perusahaan.',
        tip: 'Tidak perlu tutup buku manual hanya untuk melihat posisi laba rugi berjalan.',
      },
      {
        id: 'rep-filter',
        targetType: 'filter',
        title: 'Pilih Jenis Laporan & Periode Waktu 📅',
        content: 'Pilih laporan yang dibutuhkan: Laba Rugi, Neraca, Arus Kas, Buku Besar, atau Neraca Saldo. Tentukan rentang tanggal laporan.',
        tip: 'Laporan otomatis menghitung pergerakan akun pada rentang waktu yang dipilih.',
      },
      {
        id: 'rep-table',
        targetType: 'table',
        title: 'Tampilan Angka Keuangan & Saldo Bersih ⚖️',
        content: 'Laporan menampilkan pos-pos pendapatan, HPP, laba kotor, beban operasional, dan laba bersih periode berjalan.',
        tip: 'Angka dapat ditelusuri ke buku besar perkiraan untuk verifikasi audit.',
      },
      {
        id: 'rep-export',
        targetType: 'export',
        title: 'Export PDF Resmi & Excel Lengkap 🖨️',
        content: 'Cetak laporan siap audit dengan format resmi lengkap dengan kop perusahaan, tanggal cetak, dan tanda tangan Direktur & Manager Keuangan.',
        tip: 'File Excel memuat angka mentah yang mudah diolah untuk analisa lebih lanjut.',
      },
    ],
  },

  // 14. FIXED ASSETS (ASET TETAP)
  '/fixed-assets': {
    moduleName: 'Aset Tetap & Depresiasi',
    steps: [
      {
        id: 'asset-intro',
        targetType: 'banner',
        title: 'Manajemen Aset Tetap & Depresiasi 🏢',
        content: 'Mencatat aset berwujud perusahaan (Mesin, Komputer, Kendaraan, Bangunan) dan menghitung nilai penyusutan periodiknya.',
        tip: 'Membantu pelaporan nilai buku aset yang akurat pada neraca keuangan.',
      },
      {
        id: 'asset-action',
        targetType: 'action',
        title: 'Input Master Aset Baru ➕',
        content: 'Klik "Tambah Aset", masukkan nama aset, tanggal perolehan, harga beli, estimasi masa manfaat (tahun), dan nilai residu/sisa.',
        tip: 'Sistem menggunakan Metode Garis Lurus (Straight-Line Depreciation) yang paling umum dan mudah dipertanggungjawabkan.',
      },
      {
        id: 'asset-table',
        targetType: 'table',
        title: 'Daftar Aset, Nilai Buku & Akumulasi Penyusutan 📊',
        content: 'Tabel menampilkan nilai perolehan, akumulasi penyusutan hingga bulan ini, dan nilai buku bersih aset.',
        tip: 'Tersedia tombol untuk memposting jurnal beban depresiasi ke pembukuan bulanan.',
      },
    ],
  },

  // 15. PERIOD CLOSING (TUTUP BUKU)
  '/period-closing': {
    moduleName: 'Tutup Buku Periode',
    steps: [
      {
        id: 'close-intro',
        targetType: 'banner',
        title: 'Modul Tutup Buku Periode Akuntansi 🔒',
        content: 'Digunakan untuk mengunci transaksi periode lampau dan memindahkan saldo laba/rugi bersih ke akun Saldo Laba Ditahan (Retained Earnings).',
        tip: 'Mencegah perubahan atau manipulasi data transaksi pada bulan yang sudah diaudit dan dilaporkan.',
      },
      {
        id: 'close-action',
        targetType: 'action',
        title: 'Eksekusi Tutup Buku Bulanan ⚠️',
        content: 'Pastikan seluruh transaksi bulan tersebut telah selesai diinput dan diverifikasi. Klik "Tutup Buku Bulan Ini".',
        tip: 'Sistem akan membentuk jurnal penutup otomatis dan mereset akun pendapatan & beban untuk periode berikutnya.',
      },
      {
        id: 'close-table',
        targetType: 'table',
        title: 'Riwayat Periode Akuntansi yang Terkunci 📋',
        content: 'Tabel menampilkan daftar bulan/tahun yang sudah ditutup, nama staf penanggung jawab, dan tanggal eksekusi penutupan.',
        tip: 'Transaksi dengan tanggal di dalam periode terkunci otomatis dicegah oleh sistem.',
      },
    ],
  },

  // 16. BUDGETING (ANGGARAN BIAYA)
  '/budgeting': {
    moduleName: 'Penganggaran & Kontrol Biaya',
    steps: [
      {
        id: 'bud-intro',
        targetType: 'banner',
        title: 'Kontrol Anggaran Biaya (Budgeting) 🎯',
        content: 'Rencanakan batas pengeluaran untuk setiap pos akun biaya operasional per bulan atau per tahun.',
        tip: 'Membantu manajemen mengendalikan pengeluaran agar tidak melebihi rencana bisnis.',
      },
      {
        id: 'bud-action',
        targetType: 'action',
        title: 'Tetapkan Plafon Anggaran Akun ➕',
        content: 'Tentukan target maksimal biaya untuk akun-akun seperti Biaya Listrik, Biaya Pemasaran, atau Biaya Bahan Bakar.',
        tip: 'Anggaran dapat disesuaikan per departemen atau divisi perusahaan.',
      },
      {
        id: 'bud-table',
        targetType: 'table',
        title: 'Pemantauan Realisasi vs Budget 📊',
        content: 'Bagan interaktif menampilkan persentase realisasi biaya aktual dibandingkan plafon anggaran yang ditetapkan.',
        tip: 'Indikator merah akan menyala otomatis jika pengeluaran aktual melebihi anggaran.',
      },
    ],
  },

  // 17. TAX MANAGEMENT (PAJAK)
  '/tax-management': {
    moduleName: 'Manajemen Perpajakan',
    steps: [
      {
        id: 'tax-intro',
        targetType: 'banner',
        title: 'Modul Rekapitulasi Perpajakan (PPN & PPh) 🏛️',
        content: 'Merangkum Pajak Masukan (dari PO Pembelian) dan Pajak Keluaran (dari SO Penjualan) untuk keperluan kepatuhan pajak.',
        tip: 'Memudahkan akuntan menghitung SPT Masa PPN kurang bayar atau lebih bayar.',
      },
      {
        id: 'tax-filter',
        targetType: 'filter',
        title: 'Pilih Masa Pajak & Filter Periode 📅',
        content: 'Saring transaksi perpajakan berdasarkan bulan masa pajak untuk pencocokan dengan e-Faktur.',
        tip: 'Pastikan nomor faktur pajak telah dicatat pada setiap transaksi PO/SO.',
      },
      {
        id: 'tax-table',
        targetType: 'table',
        title: 'Rekapitulasi Faktur Pajak Masukan & Keluaran 📑',
        content: 'Tabel merangkum DPP (Dasar Pengenaan Pajak), tarif PPN 11%, dan selisih PPN Kurang/Lebih Bayar.',
        tip: 'Mendukung ekspor data untuk lampiran laporan SPT Masa.',
      },
    ],
  },

  // 18. SALES QUOTATIONS (PENAWARAN SQ)
  '/sales-quotations': {
    moduleName: 'Penawaran Harga (Sales Quotation)',
    steps: [
      {
        id: 'sq-intro',
        targetType: 'banner',
        title: 'Modul Penawaran Harga (Sales Quotation) 📝',
        content: 'Membuat surat penawaran harga resmi kepada calon pelanggan atau klien potensial.',
        tip: 'Penawaran tidak memotong stok dan tidak membentuk jurnal piutang.',
      },
      {
        id: 'sq-action',
        targetType: 'action',
        title: 'Buat Penawaran Baru & Masa Berlaku ➕',
        content: 'Pilih calon pembeli, tentukan item produk dan harga khusus penawaran, serta batas masa berlaku harga.',
        tip: 'Bisa mencetak penawaran harga dalam format PDF formal untuk dikirim ke klien.',
      },
      {
        id: 'sq-table',
        targetType: 'table',
        title: 'Konversi Cepat Menjadi Sales Order (SO) 🚀',
        content: 'Ketika klien menyetujui penawaran, klik tombol "Konversi ke SO". Sistem akan membuat Sales Order otomatis tanpa perlu input ulang!',
        tip: 'Menghemat waktu staf penjualan dan meminimalkan salah ketik data pesanan.',
      },
    ],
  },

  // 19. RETURNS (RETUR BARANG)
  '/returns': {
    moduleName: 'Retur Penjualan & Pembelian',
    steps: [
      {
        id: 'ret-intro',
        targetType: 'banner',
        title: 'Modul Retur Penjualan & Pembelian 🔁',
        content: 'Menangani pengembalian fisik barang rusak, cacat, salah kirim, atau barang klaim garansi.',
        tip: 'Mencakup Retur Penjualan (dari customer) dan Retur Pembelian (ke supplier).',
      },
      {
        id: 'ret-action',
        targetType: 'action',
        title: 'Catat Transaksi Retur Baru ➕',
        content: 'Pilih tipe retur, nomor referensi transaksi asal (DO atau PO), produk yang dikembalikan, kuantitas, dan alasan retur.',
        tip: 'Pilih kondisi fisik barang: Masuk Karantina (Rusak) atau Masuk Kembali ke Stok Siap Jual.',
      },
      {
        id: 'ret-table',
        targetType: 'table',
        title: 'Otomasi Pemotongan Tagihan & Jurnal Koreksi ⚖️',
        content: 'Saat retur divalidasi, sistem otomatis memotong saldo piutang/utang terkait dan memposting jurnal koreksi persediaan & HPP.',
        tip: 'Nota Retur resmi dapat dicetak sebagai bukti serah terima pengembalian.',
      },
    ],
  },

  // 20. STOCK ADJUSTMENT (STOK OPNAME)
  '/stock-adjustment': {
    moduleName: 'Stok Opname & Penyesuaian',
    steps: [
      {
        id: 'adj-intro',
        targetType: 'banner',
        title: 'Modul Stok Opname & Penyesuaian Persediaan 📋',
        content: 'Digunakan saat audit fisik periodik untuk mencocokkan jumlah stok fisik nyata di rak gudang dengan data di sistem.',
        tip: 'Menangani kondisi barang selisih lebih, selisih kurang, barang rusak, atau hilang.',
      },
      {
        id: 'adj-action',
        targetType: 'action',
        title: 'Input Hasil Hitungan Fisik Gudang 📝',
        content: 'Pilih produk dan lokasi rak, masukkan jumlah fisik riil yang dihitung oleh tim opname. Sistem otomatis menghitung selisih (varians).',
        tip: 'Wajib menginput alasan penyesuaian (contoh: susut timbangan, bocor, selisih hitung awal).',
      },
      {
        id: 'adj-table',
        targetType: 'table',
        title: 'Penyelarasan Stok & Jurnal Selisih ⚖️',
        content: 'Saat disetujui, stok sistem langsung disamakan dengan fisik nyata, dan sistem memposting jurnal Penyesuaian Persediaan (Biaya Selisih Opname).',
        tip: 'Laporan hasil opname dapat dicetak untuk ditandatangani supervisor gudang dan auditor.',
      },
    ],
  },

  // 21. BATCH & LOTS (KEDALUWARSA)
  '/batch-lots': {
    moduleName: 'Manajemen Batch, Lot & Expired',
    steps: [
      {
        id: 'lot-intro',
        targetType: 'banner',
        title: 'Manajemen Batch, Nomor Lot & Expired Date 🏷️',
        content: 'Lacak riwayat perjalanan setiap lot produk dari saat datang, disimpan di gudang, hingga keluar ke customer.',
        tip: 'Sangat penting untuk industri farmasi, kosmetik, makanan/minuman, dan manufaktur.',
      },
      {
        id: 'lot-filter',
        targetType: 'filter',
        title: 'Filter Status Lot: AVAILABLE, QUARANTINE, REJECTED 🛑',
        content: 'Anda dapat mengkarantina lot barang yang dicurigai cacat atau mendekati tanggal kedaluwarsa agar staf gudang tidak bisa mengeluarkannya.',
        tip: 'Barang berstatus QUARANTINE otomatis dicegah keluar pada saat transaksi DO / Outbound.',
      },
      {
        id: 'lot-table',
        targetType: 'table',
        title: 'Peringatan Dini Kedaluwarsa (Expired Warning) ⏰',
        content: 'Tabel menampilkan indikator warna untuk lot yang sudah expired (merah) atau mendekati masa kedaluwarsa dalam 30/60/90 hari.',
        tip: 'Gunakan informasi ini untuk promo cuci gudang atau retur ke pabrik sebelum expired.',
      },
    ],
  },

  // 22. WAREHOUSES (MULTI-GUDANG)
  '/warehouses': {
    moduleName: 'Multi-Gudang & Transfer Stok',
    steps: [
      {
        id: 'wh-intro',
        targetType: 'banner',
        title: 'Multi-Gudang & Transfer Stok Antar Gudang 🏭',
        content: 'Kelola banyak lokasi fisik gudang sekaligus: Gudang Pusat, Gudang Transit, Gudang Toko, atau Gudang Bahan Baku.',
        tip: 'Setiap gudang memiliki kartu stok dan kapasitas penyimpanannya masing-masing.',
      },
      {
        id: 'wh-action',
        targetType: 'action',
        title: 'Formulir Transfer Stok Antar Gudang 🚚',
        content: 'Pindahkan stok barang dari Gudang Asal ke Gudang Tujuan. Sistem akan memvalidasi kecukupan stok di gudang asal.',
        tip: 'Mendukung status pengiriman: IN_TRANSIT (dalam perjalanan) dan RECEIVED (sudah sampai di tujuan).',
      },
      {
        id: 'wh-table',
        targetType: 'table',
        title: 'Daftar Lokasi Gudang & Kapasitas Stok 📦',
        content: 'Tabel menampilkan daftar gudang aktif, alamat, penanggung jawab gudang, dan total item yang tersimpan.',
        tip: 'Bisa menambah gudang baru sewaktu-waktu sesuai ekspansi bisnis.',
      },
    ],
  },

  // 23. SUPPLIERS & CUSTOMERS (MITRA BISNIS)
  '/suppliers-customers': {
    moduleName: 'Master Supplier & Customer',
    steps: [
      {
        id: 'sc-intro',
        targetType: 'banner',
        title: 'Master Data Supplier & Pelanggan (Mitra Bisnis) 👥',
        content: 'Pusat database seluruh rekanan bisnis perusahaan: vendor pengadaan barang dan customer pembeli.',
        tip: 'Data kontak yang lengkap memudahkan komunikasi pengiriman barang dan penagihan faktur.',
      },
      {
        id: 'sc-action',
        targetType: 'action',
        title: 'Tambah Kontak & Informasi Perpajakan ➕',
        content: 'Masukkan nama perusahaan/toko, nomor telepon, alamat pengiriman, email faktur, dan nomor NPWP.',
        tip: 'Atur termin pembayaran baku (TOP) agar otomatis terisi saat membuat PO atau SO.',
      },
      {
        id: 'sc-filter',
        targetType: 'filter',
        title: 'Pencarian Mitra Bisnis & Tipe Kontak 🔍',
        content: 'Filter berdasarkan kelompok: Supplier saja, Customer saja, atau Semua Mitra.',
        tip: 'Gunakan pencarian untuk menemukan nomor telepon atau nama penanggung jawab.',
      },
      {
        id: 'sc-table',
        targetType: 'table',
        title: 'Batas Kredit (Credit Limit) Customer 🛡️',
        content: 'Tentukan batas maksimal plafon piutang yang diizinkan untuk customer tertentu guna memitigasi risiko gagal bayar.',
        tip: 'Sistem akan memberi peringatan jika pesanan customer melebihi credit limit yang ditentukan.',
      },
    ],
  },

  // 24. PRODUCTS & RACKS (MASTER PRODUK)
  '/products': {
    moduleName: 'Master Produk & Lokasi Rak',
    steps: [
      {
        id: 'prd-intro',
        targetType: 'banner',
        title: 'Katalog Master Produk & Lokasi Rak 📦',
        content: 'Database seluruh barang yang dikelola perusahaan: kode SKU, nama item, satuan fisik, harga jual, dan rak penyimpanan.',
        tip: 'Pondasi utama sebelum melakukan transaksi pembelian, stok, dan penjualan.',
      },
      {
        id: 'prd-action',
        targetType: 'action',
        title: 'Tambah Produk Baru ➕',
        content: 'Klik "Tambah Produk" untuk mendaftarkan barang baru. Masukkan Kode SKU unik, Nama Produk, Satuan Dasar (PCS/KG), dan Harga Jual.',
        tip: 'Gunakan ikon tanda tanya (?) pada setiap kolom form untuk melihat contoh dan petunjuk pengisian.',
      },
      {
        id: 'prd-filter',
        targetType: 'filter',
        title: 'Pencarian Produk & Lokasi Rak 🔍',
        content: 'Cari produk berdasarkan kode SKU, nama item, atau filter berdasarkan kategori lokasi rak.',
        tip: 'Memudahkan pengecekan harga jual dan ketersediaan barang.',
      },
      {
        id: 'prd-table',
        targetType: 'table',
        title: 'Multi-Unit Kemasan & Barcode Bertingkat 📦➡️📦',
        content: 'Fitur konversi satuan kemasan: misal 1 Box = 24 Pcs. Daftarkan barcode kardus agar saat discan otomatis terhitung 24 unit.',
        tip: 'Mempercepat proses bongkar muat barang masuk dalam jumlah besar.',
      },
      {
        id: 'prd-export',
        targetType: 'export',
        title: 'Ekspor Data Produk ke Excel 📊',
        content: 'Unduh seluruh katalog produk beserta harga dan stok aktif ke file Excel dengan tombol Export Excel.',
        tip: 'Dapat digunakan untuk rekonsiliasi harga atau pembuatan pricelist cetak.',
      },
    ],
  },

  // 25. STOCK CARD (KARTU STOK)
  '/stock-card': {
    moduleName: 'Kartu Stok Realtime',
    steps: [
      {
        id: 'sc-intro',
        targetType: 'banner',
        title: 'Kartu Stok Realtime (Buku Mutasi Barang) 🗂️',
        content: 'Melacak kronologi keluar-masuk setiap unit barang secara terperinci detik demi detik.',
        tip: 'Berfungsi sebagai bukti audit mutasi fisik barang di gudang.',
      },
      {
        id: 'sc-action',
        targetType: 'filter',
        title: 'Pilih Produk yang Ingin Dilacak 🔍',
        content: 'Pilih produk dari dropdown pencarian. Sistem akan langsung memuat kartu stok lengkap dengan saldo awal, mutasi masuk, mutasi keluar, dan saldo akhir.',
        tip: 'Tersedia filter rentang tanggal untuk melihat mutasi pada periode tertentu.',
      },
      {
        id: 'sc-table',
        targetType: 'table',
        title: 'Penelusuran Nomor Dokumen Asal 📋',
        content: 'Setiap baris mutasi menampilkan nomor bukti transaksi asal: No PO, No DO, Bukti Masuk, atau No Penyesuaian Opname.',
        tip: 'Klik nomor referensi untuk melihat detail dokumen transaksi bersangkutan.',
      },
    ],
  },

  // 26. USERS (PENGGUNA & HAK AKSES)
  '/users': {
    moduleName: 'Manajemen User & Hak Akses',
    steps: [
      {
        id: 'usr-intro',
        targetType: 'banner',
        title: 'Manajemen Pengguna & Hak Akses RBAC 👥',
        content: 'Kelola akun staf operasional dan batasi wewenang akses menu sesuai pembagian tugas (Role-Based Access Control).',
        tip: 'Hanya dapat diakses oleh Administrator Perusahaan dan Pengembang (Super Admin).',
      },
      {
        id: 'usr-action',
        targetType: 'action',
        title: 'Tambah Akun Staf Baru ➕',
        content: 'Klik "Tambah User", masukkan username, nama lengkap staf, password login yang aman, dan tentukan rolenya.',
        tip: 'Anda dapat menonaktifkan akun staf yang telah mutasi atau berhenti bekerja kapan saja.',
      },
      {
        id: 'usr-table',
        targetType: 'table',
        title: 'Pilihan Pembagian Role Hak Akses 🛡️',
        content: '1) ADMINISTRATOR: Akses penuh perusahaan, 2) ADMIN_GUDANG: Inbound, Outbound, DO, Stok, 3) ADMIN_OPERASIONAL: PO, SO, DO, Retur, 4) ADMIN_KEUANGAN: Kas/Bank, AP, AR, Jurnal & Laporan.',
        tip: 'Pembagian role yang disiplin menjaga integritas dan kerahasiaan data finansial perusahaan.',
      },
    ],
  },
};

/**
 * Mengambil konfigurasi tur untuk route tertentu
 * @param {string} pathname - path URL aktif (contoh: '/purchase-orders')
 * @returns {object|null}
 */
export function getTourForRoute(pathname) {
  if (!pathname) return MODULE_TOURS['/'];
  const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return MODULE_TOURS[cleanPath] || MODULE_TOURS['/'];
}
