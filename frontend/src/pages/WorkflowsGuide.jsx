import { useState, useMemo } from 'react';
import {
  BookOpen,
  Printer,
  Search,
  ShoppingCart,
  Truck,
  FileText,
  Undo2,
  FileCheck2,
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardCheck,
  ArrowRightLeft,
  CreditCard,
  Wallet,
  Landmark,
  FileSpreadsheet,
  Lock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Layers,
  ArrowDown,
  GitCommit,
  GitFork,
} from 'lucide-react';

export default function WorkflowsGuide() {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState({});

  // Kategori filter
  const categories = [
    { id: 'ALL', label: 'Semua Alur Modul' },
    { id: 'COMMERCIAL', label: 'Pesanan & Pengiriman' },
    { id: 'WAREHOUSE', label: 'Operasional Gudang' },
    { id: 'FINANCE', label: 'Akuntansi & Keuangan' },
  ];

  const workflows = useMemo(
    () => [
      {
        id: 'so-invoicing',
        category: 'COMMERCIAL',
        title: 'Sales Order (SO) & Penerbitan Faktur Penjualan',
        icon: ShoppingCart,
        badgeColor: 'blue',
        roles: ['Sales', 'Admin Komersial', 'Finance'],
        summary:
          'Alur penerbitan pesanan penjualan dengan pemisahan faktur. Faktur dan piutang hanya terbit saat barang terkirim (otomatis) atau saat difakturkan manual oleh finance.',
        flowchart: {
          type: 'branching',
          start: '1. Buat Sales Order (SO) Baru',
          initialStatus: {
            title: 'Status SO: OPEN',
            subtitle: 'Status Bayar: BELUM DIFAKTURKAN (Belum ada Piutang & Jurnal Pendapatan)',
          },
          decision: 'Pilih Jalur Penerbitan Faktur',
          branches: [
            {
              name: 'Opsi 1: Otomatis via Logistik (Default)',
              step: 'DO berstatus SHIPPED / DELIVERED atau Dispatch Outbound',
              desc: 'Faktur langsung terbit bersamaan dengan pengiriman barang fisik dari gudang.',
            },
            {
              name: 'Opsi 2: Manual via Finance / Sales',
              step: "Klik Tombol 'Terbitkan Faktur' di Tabel SO / Detail SO",
              desc: 'Cocok jika tagihan diterbitkan lebih awal (DP / Pembayaran di muka).',
            },
          ],
          action: {
            fn: 'generateInvoiceForSO()',
            items: [
              'Terbitkan Nomor Faktur (INV-SO/YYYY/MM/XXXX)',
              'Catat Piutang Dagang (AR) di Modul Keuangan',
              'Posting Jurnal Penjualan (Debit: Piutang Usaha, Kredit: Pendapatan & PPN)',
            ],
          },
          end: {
            title: 'Status Bayar: BELUM LUNAS / LUNAS',
            subtitle: 'Tagihan Piutang Aktif di Modul Keuangan & Menunggu Pelunasan Customer',
          },
        },
        sopSteps: [
          {
            step: '1. Input SO',
            actor: 'Sales / Komersial',
            input: 'Customer, Tanggal, Termin Hari, Daftar Produk, Harga & Diskon',
            systemAction: 'Validasi stok referensi, kalkulasi subtotal & PPN, buat nomor SO unik.',
            output: 'Dokumen SO (Status: OPEN, Bayar: BELUM DIFAKTURKAN)',
          },
          {
            step: '2. Verifikasi Pesanan',
            actor: 'Pimpinan / Sales Spv',
            input: 'Review limit piutang customer & ketersediaan stok produk',
            systemAction: 'Persetujuan pesanan penjualan untuk dijadwalkan pengiriman.',
            output: 'SO siap diproses Delivery Order (DO)',
          },
          {
            step: '3. Penerbitan Faktur',
            actor: 'Sistem Logistik / Finance',
            input: 'Pengiriman DO atau Klik Tombol "Terbitkan Faktur"',
            systemAction: 'Panggil generateInvoiceForSO(): terbitkan nomor invoice resmi, catat AR & jurnal.',
            output: 'Faktur Penjualan (INV-SO-XXXX) & Entri Piutang',
          },
          {
            step: '4. Pelunasan Piutang',
            actor: 'Admin Keuangan',
            input: 'Bukti transfer pembayaran dari pelanggan',
            systemAction: 'Rekam penerimaan kas/bank di menu Piutang Usaha (AR), posting jurnal kas masuk.',
            output: 'Status SO menjadi LUNAS, Piutang Berkurang',
          },
        ],
        businessRules: [
          'SO baru TIDAK langsung memotong piutang atau membukukan pendapatan, mencegah piutang macet fiktif jika pesanan batal dikirim.',
          'Penerbitan faktur bersifat idempotem: jika DO dikirim berkali-kali secara bertahap, hanya satu faktur utama yang terbit kecuali dibuat DO faktur parsial.',
          'Jurnal Otomatis yang Terbit: Debit 1-1010 Piutang Usaha, Kredit 4-1001 Pendapatan Penjualan, Kredit 2-1002 PPN Keluaran (jika ada pajak).',
        ],
      },
      {
        id: 'do-shipping',
        category: 'COMMERCIAL',
        title: 'Delivery Order (DO) & Pemotongan Stok Fisik + HPP',
        icon: Truck,
        badgeColor: 'emerald',
        roles: ['Logistik', 'Staff Gudang', 'Finance'],
        summary:
          'Alur pengiriman barang pesanan ke pelanggan. Mengubah status DO menjadi SHIPPED seketika memotong stok fisik lot gudang, mencatat transaksi keluar, dan membukukan Jurnal HPP.',
        flowchart: {
          type: 'branching',
          start: '1. Buat Delivery Order (DO) dari Sales Order (SO)',
          initialStatus: {
            title: 'Pilih Mode Penyimpanan DO',
            subtitle: 'Tentukan apakah barang langsung dikirim sekarang atau disimpan sebagai draf',
          },
          decision: 'Pilih Mode Simpan DO',
          branches: [
            {
              name: 'Opsi A: Simpan Sebagai Draft',
              step: 'Status DO: DRAFT (Stok Belum Berkurang)',
              desc: 'Digunakan saat dokumen disiapkan sebelum armada atau barang siap di muat.',
            },
            {
              name: 'Opsi B: Simpan & Kirim Sekarang',
              step: 'Status DO: SHIPPED / DELIVERED',
              desc: 'Eksekusi langsung pemotongan stok fisik & HPP seketika.',
            },
          ],
          action: {
            fn: 'processDoShipment()',
            items: [
              'Lock Nomor Lot Gudang (FOR UPDATE) & Validasi Expired/QC',
              'Potong Stok Fisik Gudang (product_lots.stok_qty)',
              'Catat Transaksi Pengeluaran Gudang (OUT-YYYYMMDD-XXXX)',
              'Catat Kartu Mutasi Stok (Tipe: KELUAR, Ref: No DO)',
              'Posting Jurnal HPP Otomatis (Debit: 5-1001 Beban Pokok, Kredit: 1-1020 Persediaan)',
              'Perbarui Qty Terkirim SO & Terbitkan Faktur jika belum difakturkan',
            ],
          },
          end: {
            title: 'DO Berstatus SHIPPED / DELIVERED',
            subtitle: 'Stok Fisik Akurat & Proteksi Aktif (Dilarang Hapus / Revert ke DRAFT)',
          },
        },
        sopSteps: [
          {
            step: '1. Alokasi Lot',
            actor: 'Admin Logistik',
            input: 'Pilih Sales Order, tentukan nomor lot barang yang akan dikirim & Qty kirim',
            systemAction: 'Validasi stok per lot mencukupi dan lot tidak berstatus QUARANTINE/EXPIRED.',
            output: 'Form DO lengkap dengan detail lot pengiriman',
          },
          {
            step: '2. Pengiriman & Dispatch',
            actor: 'Staff Gudang / Supir',
            input: 'Klik "Kirim DO (Potong Stok)" atau tombol truk di tabel',
            systemAction: 'Eksekusi fungsi processDoShipment() secara atomic transaction.',
            output: 'Surat Jalan / Delivery Order resmi tercetak & Stok terpotong',
          },
          {
            step: '3. Penerimaan Pelanggan',
            actor: 'Ekspedisi / Customer',
            input: 'Konfirmasi barang sampai di lokasi pelanggan',
            systemAction: 'Ubah status DO menjadi DELIVERED.',
            output: 'Bukti Tanda Terima Barang (POD) terarsipkan',
          },
        ],
        businessRules: [
          'DO yang sudah SHIPPED atau DELIVERED DILINDUNGI secara permanen: tidak dapat dihapus dan tidak dapat dikembalikan ke status DRAFT.',
          'Jika terjadi pembatalan setelah pengiriman barang fisik, alur yang benar adalah mencatat Retur Penjualan.',
          'Jurnal Otomatis HPP: Debit 5-1001 Beban Pokok Pendapatan, Kredit 1-1020 Persediaan Barang Dagang.',
        ],
      },
      {
        id: 'po-procurement',
        category: 'COMMERCIAL',
        title: 'Purchase Order (PO) & Pengadaan Barang ke Supplier',
        icon: FileText,
        badgeColor: 'amber',
        roles: ['Purchasing', 'Staff Gudang', 'Finance'],
        summary:
          'Alur pemesanan barang ke supplier hingga penerimaan fisik barang di gudang dan pencatatan utang usaha (Accounts Payable).',
        flowchart: {
          type: 'linear',
          steps: [
            {
              title: '1. Input Purchase Order (PO)',
              desc: 'Pilih Supplier, Gudang Tujuan, Tanggal Jatuh Tempo, Item Produk, dan Harga Beli.',
            },
            {
              title: '2. Approval Manajer Pengadaan',
              desc: 'Status PO berubah dari PENDING menjadi APPROVED. Kirim dokumen PO resmi ke Supplier.',
            },
            {
              title: '3. Penerimaan Fisik di Gudang (Barang Masuk / Inbound)',
              desc: 'Staff Gudang memeriksa fisik barang, nomor lot pabrik, expired date, dan input transaksi masuk.',
            },
            {
              title: '4. Pencatatan Tagihan Utang Usaha (AP)',
              desc: 'Sistem menerbitkan nomor tagihan utang (BILL-PO-XXXX) dan memposting Jurnal Pembelian.',
            },
            {
              title: '5. Pelunasan Utang ke Supplier',
              desc: 'Finance melakukan pembayaran melalui Kas/Bank sesuai termin jatuh tempo.',
            },
          ],
        },
        sopSteps: [
          {
            step: '1. Pembuatan PO',
            actor: 'Purchasing',
            input: 'Supplier, Gudang Penerima, Tanggal Janji Kirim, Produk & Harga Beli',
            systemAction: 'Hitung total belanja, kalkulasi PPN masukan, terbitkan nomor PO/YYYY/MM/XXXX.',
            output: 'Dokumen Purchase Order (Status: PENDING)',
          },
          {
            step: '2. Penerimaan Gudang',
            actor: 'Staff Gudang',
            input: 'Surat Jalan Supplier & Fisik Barang',
            systemAction: 'Cocokkan Qty fisik dengan PO, catat lot & expired date di menu Barang Masuk.',
            output: 'Dokumen Penerimaan Barang (IN-XXXX) & Stok Bertambah',
          },
          {
            step: '3. Verifikasi Invoice',
            actor: 'Admin Keuangan',
            input: 'Invoice/Kwitansi dari Supplier',
            systemAction: 'Three-Way Matching: cocokan PO, Bukti Masuk Gudang, dan Invoice Supplier.',
            output: 'Utang Usaha (AP) siap bayar',
          },
        ],
        businessRules: [
          'Jika penerimaan barang dilakukan bertahap (parsial), status PO tetap APPROVED hingga seluruh pesanan lengkap (COMPLETED).',
          'Jurnal Otomatis Pembelian: Debit 1-1020 Persediaan Barang Dagang, Debit 1-1030 PPN Masukan (jika ada), Kredit 2-1001 Utang Usaha (AP).',
        ],
      },
      {
        id: 'returns-management',
        category: 'COMMERCIAL',
        title: 'Retur Penjualan & Pembelian (Restock & Koreksi Jurnal)',
        icon: Undo2,
        badgeColor: 'rose',
        roles: ['Customer Service', 'Gudang', 'Finance'],
        summary:
          'Alur penanganan pengembalian barang dari pelanggan atau ke supplier, dilengkapi opsi pengembalian fisik ke stok gudang dan penerbitan Kredit Nota.',
        flowchart: {
          type: 'branching',
          start: '1. Catat Formulir Retur (Jual / Beli)',
          initialStatus: {
            title: 'Pilih Customer / Supplier & Alasan Retur',
            subtitle: 'Input daftar produk yang diretur, Qty, dan harga satuan',
          },
          decision: 'Opsi Restock ke Gudang?',
          branches: [
            {
              name: 'Opsi A: Centang "Kembalikan ke Stok Gudang"',
              step: 'Stok Fisik Bertambah Kembali di Lot Gudang',
              desc: 'Tercatat mutasi RETUR_JUAL, stok fisik lot pulih, dan jurnal HPP disesuaikan.',
            },
            {
              name: 'Opsi B: Jangan Centang (Barang Rusak / Musnah)',
              step: 'Stok Fisik Gudang Tidak Bertambah',
              desc: 'Dicatat sebagai pengembalian nilai tanpa menambah inventori fisik barang.',
            },
          ],
          action: {
            fn: 'Pilih Metode Kompensasi Retur',
            items: [
              'Kredit Nota (Potong Tagihan Piutang/Utang): Saldo AR/AP customer berkurang otomatis.',
              'Refund Kas/Bank: Mengeluarkan dana dari rekening kas/bank untuk pengembalian dana tunai.',
              'Posting Jurnal Retur & Penyesuaian HPP/Persediaan secara seimbang.',
            ],
          },
          end: {
            title: 'Retur Berstatus COMPLETED',
            subtitle: 'Kredit Nota Terbit, Saldo Piutang/Utang Terpotong, & Kartu Stok Terupdate',
          },
        },
        sopSteps: [
          {
            step: '1. Penerimaan Retur',
            actor: 'CS / Gudang',
            input: 'Fisik barang yang dikembalikan & alasan retur pelanggan',
            systemAction: 'Pemeriksaan kondisi fisik barang: apakah layak restock atau rusak total.',
            output: 'Catatan kondisi barang',
          },
          {
            step: '2. Input Retur di Sistem',
            actor: 'Admin Komersial / Finance',
            input: 'Pilih Customer, Gudang, centang "Kembalikan ke Stok" (jika layak), pilih Kredit Nota',
            systemAction: 'Simpan sales_returns, potong sisa piutang di accounts_receivable, catat mutasi stok.',
            output: 'Nomor Retur (SR-YYYYMM-XXXX) & Jurnal Balik Terposting',
          },
        ],
        businessRules: [
          'Jika memilih Kredit Nota (Potong Piutang), sistem memotong piutang customer secara FIFO mulai dari tagihan yang paling mendekati jatuh tempo.',
          'Jurnal Retur Penjualan: Debit 4-1003 Retur Penjualan, Kredit 1-1010 Piutang Usaha (atau Kas).',
          'Jika opsi Restock aktif: Debit 1-1020 Persediaan Barang Dagang, Kredit 5-1001 Beban Pokok Penjualan (HPP).',
        ],
      },
      {
        id: 'inbound-warehouse',
        category: 'WAREHOUSE',
        title: 'Barang Masuk (Inbound & Kontrol Mutu Lot)',
        icon: ArrowDownToLine,
        badgeColor: 'teal',
        roles: ['Admin Gudang', 'Petugas QC', 'Kepala Gudang'],
        summary:
          'Pencatatan penerimaan barang fisik di area penerimaan (*receiving dock*), verifikasi batch/lot pabrik, tanggal kedaluwarsa, dan penempatan rak penyimpanan.',
        flowchart: {
          type: 'linear',
          steps: [
            {
              title: '1. Verifikasi Dokumen & Surat Jalan',
              desc: 'Cocokkan surat jalan supplier dengan nomor Purchase Order (PO) pada sistem.',
            },
            {
              title: '2. Pemeriksaan Mutu (Quality Control / QC)',
              desc: 'Cek fisik kemasan, segel, dan suhu penyimpanan. Tentukan status QC: PASSED atau QUARANTINE.',
            },
            {
              title: '3. Registrasi Nomor Lot & Expired Date',
              desc: 'Input nomor lot pabrik, tanggal produksi, dan tanggal kedaluwarsa ke form Barang Masuk.',
            },
            {
              title: '4. Penempatan Rak Penyimpanan (Putaway)',
              desc: 'Tentukan lokasi gudang dan rak penyimpanan barang untuk kemudahan pencarian saat picking.',
            },
            {
              title: '5. Simpan Transaksi Masuk (IN-YYYYMMDD-XXXX)',
              desc: 'Stok bertambah di product_lots, kartu mutasi terbit (Tipe: MASUK), dan status PO terupdate.',
            },
          ],
        },
        sopSteps: [
          {
            step: '1. Unloading & QC',
            actor: 'Staff Gudang / QC',
            input: 'Fisik barang di dermaga bongkar muat',
            systemAction: 'Pengecekan fisik dan suhu barang.',
            output: 'Lembar periksa QC',
          },
          {
            step: '2. Input Transaksi Masuk',
            actor: 'Admin Gudang',
            input: 'Pilih PO, pilih produk, isi Nomor Lot, Expired Date, Qty, dan Gudang Tujuan',
            systemAction: 'Insert ke transactions (tipe: MASUK), buat entri product_lots, catat stock_mutations.',
            output: 'Bukti Penerimaan Barang (IN-XXXX) & Stok bertambah',
          },
        ],
        businessRules: [
          'Barang yang memiliki status QC QUARANTINE atau HOLD tidak akan dapat dipilih saat proses pembuatan Delivery Order.',
          'Nomor lot bersifat unik per produk dan menjadi kunci pelacakan traceability produk medis/farmasi.',
        ],
      },
      {
        id: 'outbound-warehouse',
        category: 'WAREHOUSE',
        title: 'Barang Keluar (Outbound Logistik & Pengeluaran)',
        icon: ArrowUpFromLine,
        badgeColor: 'indigo',
        roles: ['Staff Gudang', 'Picker / Packer', 'Logistik'],
        summary:
          'Proses pengeluaran barang dari rak penyimpanan untuk pemenuhan Delivery Order (DO) maupun pengeluaran internal (sampel, rusak, pemakaian gudang).',
        flowchart: {
          type: 'linear',
          steps: [
            {
              title: '1. Ambil Dokumen Referensi Pengeluaran',
              desc: 'Buka menu Barang Keluar, pilih nomor Delivery Order (DO) atau pilih Pengeluaran Bebas.',
            },
            {
              title: '2. Pengambilan Barang di Rak (Picking)',
              desc: 'Ambil barang sesuai lokasi rak dan pastikan nomor lot sesuai prinsip FIFO / FEFO.',
            },
            {
              title: '3. Verifikasi & Pengepakan (Packing)',
              desc: 'Periksa kembali kesesuaian fisik barang, nomor lot, dan kuantitas sebelum dikemas.',
            },
            {
              title: '4. Eksekusi Pengeluaran (OUT-YYYYMMDD-XXXX)',
              desc: 'Sistem memotong stok lot terkait, mencatat riwayat mutasi KELUAR, dan mencetak surat jalan.',
            },
          ],
        },
        sopSteps: [
          {
            step: '1. Picking List',
            actor: 'Staff Gudang',
            input: 'Dokumen DO yang sudah terverifikasi',
            systemAction: 'Sistem menampilkan lokasi rak dan lot terdekat sesuai FEFO (First Expired First Out).',
            output: 'Barang siap di area pengepakan',
          },
          {
            step: '2. Dispatch Outbound',
            actor: 'Admin Gudang',
            input: 'Konfirmasi kuantitas dan nomor lot fisik yang diambil',
            systemAction: 'Validasi stok cukup, potong product_lots, buat transaksi OUT-XXXX.',
            output: 'Stok berkurang, kartu mutasi tercatat',
          },
        ],
        businessRules: [
          'Jika pengeluaran barang sudah diproses langsung via tombol "Kirim DO (Potong Stok)" di menu Delivery Orders, modul Outbound secara cerdas mendeteksi dan mencegah pemotongan ganda (double-dispatch).',
        ],
      },
      {
        id: 'stock-opname',
        category: 'WAREHOUSE',
        title: 'Stok Opname (Audit Persediaan & Penyesuaian)',
        icon: ClipboardCheck,
        badgeColor: 'purple',
        roles: ['Auditor Internal', 'Kepala Gudang', 'Accounting'],
        summary:
          'Pemeriksaan fisik persediaan secara berkala (*stock take*) untuk mencocokkan stok fisik di lapangan dengan saldo sistem, serta membukukan jurnal penyesuaian jika ada selisih.',
        flowchart: {
          type: 'branching',
          start: '1. Inisiasi Jadwal Stok Opname',
          initialStatus: {
            title: 'Pilih Gudang Target Audit',
            subtitle: 'Sistem mengunci saldo buku sistem per tanggal dan jam audit',
          },
          decision: 'Hasil Penghitungan Fisik (Blind Count)',
          branches: [
            {
              name: 'Hasil Cocok (Selisih = 0)',
              step: 'Status: MATCHED / SESUAI',
              desc: 'Tidak ada penyesuaian stok. Dokumen opname ditutup sebagai audit bersih.',
            },
            {
              name: 'Ada Selisih (Fisik != Sistem)',
              step: 'Status: DISCREPANCY / SELISIH',
              desc: 'Sistem menghitung selisih kuantitas dan nilai rupiah (Surplus / Defisit).',
            },
          ],
          action: {
            fn: 'Posting Penyesuaian Stok (Stock Adjustment)',
            items: [
              'Update stok fisik lot gudang agar sama persis dengan hasil hitung fisik.',
              'Catat kartu mutasi stok dengan tipe: PENYESUAIAN_OPNAME.',
              'Posting Jurnal Selisih Stok ke Buku Besar Akuntansi secara otomatis.',
            ],
          },
          end: {
            title: 'Audit Selesai & Stok Fisik Tersinkronisasi',
            subtitle: 'Laporan Berita Acara Stok Opname Terbit & Buku Besar Seimbang',
          },
        },
        sopSteps: [
          {
            step: '1. Persiapan Audit',
            actor: 'Auditor & Gudang',
            input: 'Pilih gudang yang akan diaudit, hentikan sementara pergerakan barang (cut-off transaksi)',
            systemAction: 'Sistem menampilkan daftar produk beserta kuantitas tercatat sistem.',
            output: 'Lembar Kerja Hitung Fisik (*Counting Sheet*)',
          },
          {
            step: '2. Penghitungan Fisik',
            actor: 'Tim Counter Lapangan',
            input: 'Hitung fisik riil di rak gudang, catat nomor lot dan kondisi',
            systemAction: 'Input kuantitas fisik hasil hitung ke form Stok Opname.',
            output: 'Selisih kuantitas otomatis terhitung',
          },
          {
            step: '3. Approval & Posting',
            actor: 'Kepala Gudang & Finance Manager',
            input: 'Verifikasi alasan selisih (misal: barang susut, rusak, atau salah hitung)',
            systemAction: 'Klik "Posting Penyesuaian": update stok fisik & jurnal akuntansi selisih.',
            output: 'Stok gudang akurat & Berita Acara tertandatangani',
          },
        ],
        businessRules: [
          'Jurnal Selisih Kurang (Defisit/Hilang/Rusak): Debit 6-1030 Beban Kerusakan & Selisih Stok, Kredit 1-1020 Persediaan Barang Dagang.',
          'Jurnal Selisih Lebih (Surplus): Debit 1-1020 Persediaan Barang Dagang, Kredit 4-2001 Pendapatan Lain-lain.',
        ],
      },
      {
        id: 'warehouse-transfer',
        category: 'WAREHOUSE',
        title: 'Multi-Gudang & Transfer Stok Antar Gudang',
        icon: ArrowRightLeft,
        badgeColor: 'sky',
        roles: ['Admin Gudang Asal', 'Admin Gudang Tujuan', 'Logistik'],
        summary:
          'Pemindahan persediaan barang antar fasilitas gudang (misal: dari Gudang Pusat ke Gudang Cabang atau Gudang Rumah Sakit) secara terkoordinasi.',
        flowchart: {
          type: 'linear',
          steps: [
            {
              title: '1. Buat Permintaan Transfer Antar Gudang',
              desc: 'Tentukan Gudang Asal, Gudang Tujuan, Nomor Lot Produk, dan Jumlah Kuantitas yang Diminta.',
            },
            {
              title: '2. Pengeluaran dari Gudang Asal',
              desc: 'Gudang Asal memverifikasi muatan dan memotong stok fisik. Status transfer: IN_TRANSIT.',
            },
            {
              title: '3. Perjalanan Armada Logistik',
              desc: 'Barang dalam perjalanan di bawah tanggung jawab kurir / ekspedisi internal.',
            },
            {
              title: '4. Penerimaan & Konfirmasi di Gudang Tujuan',
              desc: 'Gudang Tujuan memeriksa fisik barang dan mengklik tombol "Konfirmasi Terima".',
            },
            {
              title: '5. Stok Bertambah di Gudang Tujuan',
              desc: 'Status transfer menjadi COMPLETED. Mutasi stok tercatat rapi di kedua kartu stok gudang.',
            },
          ],
        },
        sopSteps: [
          {
            step: '1. Form Transfer',
            actor: 'Admin Gudang Asal',
            input: 'Gudang Asal, Gudang Tujuan, Produk, Lot, dan Qty',
            systemAction: 'Validasi ketersediaan stok di gudang asal.',
            output: 'Surat Jalan Transfer Antar Gudang',
          },
          {
            step: '2. Penerimaan Cabang',
            actor: 'Admin Gudang Tujuan',
            input: 'Fisik barang tiba di lokasi tujuan',
            systemAction: 'Konfirmasi penerimaan: stok masuk ke gudang tujuan dengan nomor lot yang sama.',
            output: 'Stok berpindah tanpa menimbulkan selisih nilai',
          },
        ],
        businessRules: [
          'Transfer antar gudang dalam entitas/tenant yang sama TIDAK menimbulkan jurnal pendapatan atau utang/piutang, melainkan mutasi lokasi persediaan murni.',
        ],
      },
      {
        id: 'ap-cycle',
        category: 'FINANCE',
        title: 'Utang Usaha (AP) & Pembayaran ke Supplier',
        icon: CreditCard,
        badgeColor: 'orange',
        roles: ['Admin Keuangan', 'Finance Manager', 'Kasir'],
        summary:
          'Pengelolaan kewajiban pembayaran kepada pemasok/supplier, pemantauan tanggal jatuh tempo, dan rekonsiliasi pembayaran bertahap maupun lunas.',
        flowchart: {
          type: 'linear',
          steps: [
            {
              title: '1. Terbit Tagihan Utang dari PO / Inbound',
              desc: 'Sistem mencatat entri accounts_payable berstatus BELUM_LUNAS dengan tanggal jatuh tempo sesuai termin.',
            },
            {
              title: '2. Verifikasi Tagihan (Three-Way Matching)',
              desc: 'Finance membandingkan dokumen PO, Bukti Masuk Gudang, dan Faktur Tagihan dari Supplier.',
            },
            {
              title: '3. Eksekusi Pembayaran via Kas/Bank',
              desc: 'Buka menu Utang Usaha (AP) -> Klik "Bayar Tagihan" -> Pilih Rekening Kas/Bank sumber dana.',
            },
            {
              title: '4. Pelunasan & Jurnal Otomatis',
              desc: 'Sisa utang berkurang (Status: SEBAGIAN / LUNAS) dan sistem memposting Jurnal Pelunasan Utang.',
            },
          ],
        },
        sopSteps: [
          {
            step: '1. Monitor Jatuh Tempo',
            actor: 'Staff Keuangan',
            input: 'Menu Utang Usaha (AP) & Notifikasi Jatuh Tempo',
            systemAction: 'Sistem mengurutkan tagihan berdasarkan tanggal jatuh tempo terdekat.',
            output: 'Daftar rencana pembayaran mingguan',
          },
          {
            step: '2. Bayar Tagihan',
            actor: 'Kasir / Finance',
            input: 'Nomor AP, Nominal Bayar, Tanggal Bayar, Akun Kas/Bank, No Referensi Bank',
            systemAction: 'Update sisa_utang, kurangi saldo kas/bank, posting jurnal pengeluaran kas.',
            output: 'Bukti Kas Keluar & Kuitansi Pelunasan',
          },
        ],
        businessRules: [
          'Dukungan Pembayaran Parsial: Tagihan dapat dicicil beberapa kali hingga sisa_utang bernilai Rp 0.',
          'Jurnal Pelunasan Utang: Debit 2-1001 Utang Usaha, Kredit 1-100X Rekening Kas/Bank Terkait.',
        ],
      },
      {
        id: 'ar-cycle',
        category: 'FINANCE',
        title: 'Piutang Usaha (AR) & Penerimaan Pembayaran Customer',
        icon: Wallet,
        badgeColor: 'green',
        roles: ['Admin Piutang', 'Finance Manager', 'Kasir'],
        summary:
          'Pengelolaan tagihan piutang kepada pelanggan rumah sakit, apotek, dan distributor, pemantauan umur piutang (*Aging AR*), dan pencatatan penerimaan dana.',
        flowchart: {
          type: 'linear',
          steps: [
            {
              title: '1. Terbit Faktur Piutang dari Penjualan (SO/DO)',
              desc: 'Entri piutang otomatis tercatat di accounts_receivable dengan status BELUM_LUNAS.',
            },
            {
              title: '2. Penagihan & Pengiriman Faktur ke Customer',
              desc: 'Faktur komersial dikirimkan ke pelanggan disertai bukti tanda terima barang (DO).',
            },
            {
              title: '3. Penerimaan Pembayaran dari Customer',
              desc: 'Pelanggan mentransfer dana ke rekening bank perusahaan (BCA / Mandiri / Kas).',
            },
            {
              title: '4. Pencatatan Penerimaan Pembayaran',
              desc: 'Buka menu Piutang Usaha (AR) -> Klik "Terima Pembayaran" -> Pilih Rekening Bank Penerima.',
            },
            {
              title: '5. Pelunasan & Jurnal Otomatis',
              desc: 'Sisa piutang berkurang (Status: SEBAGIAN / LUNAS) dan Jurnal Kas Masuk terbit otomatis.',
            },
          ],
        },
        sopSteps: [
          {
            step: '1. Rekonsiliasi Mutasi Bank',
            actor: 'Finance',
            input: 'Rekening Koran Bank BCA / Mandiri',
            systemAction: 'Mencocokkan transfer masuk pelanggan dengan nomor faktur INV-SO-XXXX.',
            output: 'Data konfirmasi pembayaran',
          },
          {
            step: '2. Terima Pembayaran di AR',
            actor: 'Admin Piutang',
            input: 'Nomor Faktur, Nominal Masuk, Akun Bank Tujuan, Bukti Transfer',
            systemAction: 'Update sisa_piutang, tambah saldo rekening bank, posting jurnal debit kas/bank kredit AR.',
            output: 'Kuitansi Resmi Penerimaan Pembayaran',
          },
        ],
        businessRules: [
          'Dukungan Aging Piutang: Sistem mengelompokkan umur piutang menjadi Current (0-30 hari), Overdue (31-60 hari, 61-90 hari, dan >90 hari).',
          'Jurnal Penerimaan Piutang: Debit 1-100X Kas/Bank Penerima, Kredit 1-1010 Piutang Usaha (AR).',
        ],
      },
      {
        id: 'cash-bank-gl',
        category: 'FINANCE',
        title: 'Kas & Rekening Bank serta Jurnal Umum Otomatis',
        icon: Landmark,
        badgeColor: 'violet',
        roles: ['Akuntan', 'Finance Supervisor'],
        summary:
          'Pengelolaan kas kecil, mutasi antar-rekening bank, dan pembukuan transaksi operasional langsung (beban listrik, gaji, ATK) ke dalam Jurnal Umum dan Buku Besar.',
        flowchart: {
          type: 'branching',
          start: '1. Transaksi Keuangan Langsung (Di Luar Faktur PO/SO)',
          initialStatus: {
            title: 'Tentukan Jenis Transaksi Keuangan',
            subtitle: 'Pilih apakah transaksi berupa Kas Keluar, Kas Masuk, atau Transfer Internal',
          },
          decision: 'Pilih Tipe Transaksi Kas/Bank',
          branches: [
            {
              name: 'Kas Keluar (Disbursement)',
              step: 'Input Beban Operasional (Gaji, Sewa, Listrik, BBM)',
              desc: 'Debit: Akun Beban Terkait (6-XXXX), Kredit: Kas/Bank Sumber (1-100X).',
            },
            {
              name: 'Kas Masuk (Receipts)',
              step: 'Input Pendapatan Non-Penjualan (Jasa, Bunga Bank, Modal)',
              desc: 'Debit: Kas/Bank Penerima (1-100X), Kredit: Pendapatan Lain (4-200X).',
            },
            {
              name: 'Mutasi Antar Kas/Bank',
              step: 'Tarik Tunai / Pindah Dana antar Rekening',
              desc: 'Debit: Rekening Tujuan (1-100X), Kredit: Rekening Asal (1-100X).',
            },
          ],
          action: {
            fn: 'Pencatatan Buku Besar Real-Time',
            items: [
              'Entri tersimpan di cash_bank_transactions & journal_entries secara atomic.',
              'Keseimbangan Debit dan Kredit dipastikan 100% balanced sebelum disimpan.',
              'Buku Besar (General Ledger) dan Neraca Saldo terupdate seketika.',
            ],
          },
          end: {
            title: 'Laporan Keuangan Terupdate Real-Time',
            subtitle: 'Neraca, Laba Rugi, dan Laporan Arus Kas Siap Dicetak Kapan Saja',
          },
        },
        sopSteps: [
          {
            step: '1. Input Kas/Bank',
            actor: 'Staff Keuangan',
            input: 'Tanggal, Rekening Kas/Bank, Tipe (MASUK/KELUAR), Akun Lawan COA, Nominal, Keterangan',
            systemAction: 'Validasi saldo rekening mencukupi jika transaksi pengeluaran.',
            output: 'Bukti Kas Masuk / Kas Keluar',
          },
          {
            step: '2. Review Buku Besar',
            actor: 'Accounting',
            input: 'Filter tanggal dan akun di menu Buku Besar / Jurnal Umum',
            systemAction: 'Menampilkan seluruh mutasi debet/kredit lengkap dengan nomor referensi.',
            output: 'Laporan Buku Besar Terverifikasi',
          },
        ],
        businessRules: [
          'Prinsip Akuntansi Berpasangan (Double-Entry): Seluruh transaksi otomatis mematuhi Total Debit = Total Kredit.',
          'Mendukung multi-rekening: Kas Operasional, Bank BCA, Bank Mandiri, dan Rekening Bank Operasional Lainnya.',
        ],
      },
      {
        id: 'period-closing',
        category: 'FINANCE',
        title: 'Tutup Buku Periode (Period Closing & Data Locking)',
        icon: Lock,
        badgeColor: 'red',
        roles: ['Accounting Manager', 'Direktur Keuangan'],
        summary:
          'Prosedur penutupan buku pada akhir bulan atau akhir tahun buku untuk mengunci data transaksi historis dan memindahkan saldo laba/rugi berjalan ke ekuitas.',
        flowchart: {
          type: 'linear',
          steps: [
            {
              title: '1. Pemeriksaan Pra-Tutup Buku (Checklist)',
              desc: 'Pastikan seluruh DO & Inbound terposting, kas/bank terekonsiliasi, dan penyusutan aset tetap selesai dihitung.',
            },
            {
              title: '2. Perhitungan Laba / Rugi Periode Berjalan',
              desc: 'Sistem menghitung total Pendapatan (Akun Kepala 4) dikurangi Beban Pokok & Operasional (Akun Kepala 5 & 6).',
            },
            {
              title: '3. Eksekusi Tutup Buku Periode',
              desc: 'Buka menu Tutup Buku Periode -> Pilih Bulan & Tahun -> Klik "Tutup Buku Sekarang".',
            },
            {
              title: '4. Penguncian Data Transaksi (Data Locking)',
              desc: 'Periode yang ditutup dikunci permanen. Pengguna diblokir dari menambah, mengedit, atau menghapus transaksi di periode tersebut.',
            },
            {
              title: '5. Pembukaan Periode Baru',
              desc: 'Saldo akhir akun riil (Aset, Kewajiban, Ekuitas) otomatis menjadi saldo awal periode berikutnya.',
            },
          ],
        },
        sopSteps: [
          {
            step: '1. Audit Akhir Bulan',
            actor: 'Senior Accounting',
            input: 'Laporan Neraca Saldo & Laba Rugi sementara',
            systemAction: 'Pengecekan akun gantung / unassigned transactions.',
            output: 'Kesiapan Tutup Buku',
          },
          {
            step: '2. Kunci Periode',
            actor: 'Finance Manager',
            input: 'Pilih bulan/tahun cut-off penutupan buku',
            systemAction: 'Jurnal penutup laba berjalan ke akun 3-3001 Laba Periode Berjalan, aktifkan proteksi tanggal.',
            output: 'Laporan Keuangan Resmi Bulanan Terbit',
          },
        ],
        businessRules: [
          'Setelah periode ditutup, sistem menolak seluruh upaya manipulasi data (edit/delete) pada tanggal yang sudah dikunci.',
          'Hanya Administrator Tertinggi (Pengembang / SuperAdmin) yang memiliki wewenang khusus membuka kembali (*reopen*) periode jika diperlukan audit luar.',
        ],
      },
    ],
    []
  );

  // Filter workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((w) => {
      const matchCat = activeCategory === 'ALL' || w.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.roles.some((r) => r.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [workflows, activeCategory, searchQuery]);

  const toggleExpand = (id) => {
    setExpandedModules((prev) => {
      const current = prev[id] !== undefined ? prev[id] : true;
      return {
        ...prev,
        [id]: !current,
      };
    });
  };

  const expandAll = () => {
    const all = {};
    workflows.forEach((w) => (all[w.id] = true));
    setExpandedModules(all);
  };

  const collapseAll = () => {
    const all = {};
    workflows.forEach((w) => (all[w.id] = false));
    setExpandedModules(all);
  };

  const handlePrint = () => {
    // Buka semua akordion sebelum print agar seluruh isi tercetak
    expandAll();
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* HEADER SECTION (Disembunyikan di cetak sebagian) */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden print:bg-white print:text-slate-900 print:p-4 print:border-b-2 print:border-slate-800 print:shadow-none">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none print:hidden" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-semibold text-blue-200 print:border-slate-300 print:text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 print:hidden" />
              <span>Buku Panduan Standar Operasional Prosedur (SOP)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Diagram Alur Kerja & SOP Modul SyntesiaERP
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed print:text-slate-600">
              Panduan interaktif logika alur proses bisnis antar-modul (Pesanan, Pergudangan, dan
              Akuntansi Keuangan). Gunakan dokumen ini sebagai acuan pelatihan karyawan dan standar
              implementasi pengguna.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg transition-all"
              title="Cetak atau simpan sebagai dokumen PDF A4"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Unduh PDF SOP</span>
            </button>
            <button
              onClick={expandAll}
              className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
            >
              Buka Semua
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
            >
              Tutup Semua
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH & CATEGORY FILTER (Hidden on print) */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between print:hidden">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeCategory === c.id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari alur kerja atau modul..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* WORKFLOW CARDS LIST */}
      <div className="space-y-6">
        {filteredWorkflows.map((wf, idx) => {
          const isExpanded = expandedModules[wf.id] ?? true; // default terbuka
          const IconComp = wf.icon;

          return (
            <div
              key={wf.id}
              className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden transition-all print:border-slate-300 print:shadow-none print:break-inside-avoid print:mb-6"
            >
              {/* CARD HEADER */}
              <div
                onClick={() => toggleExpand(wf.id)}
                className="p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 shrink-0 mt-0.5`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                        MODUL #{idx + 1}
                      </span>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">{wf.title}</h2>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">{wf.summary}</p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs text-slate-500 font-medium">Peran / Aktor:</span>
                      {wf.roles.map((r) => (
                        <span
                          key={r}
                          className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 p-1 text-slate-400 print:hidden">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* CARD EXPANDABLE BODY */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-5 sm:p-6 space-y-6 bg-slate-50/40">
                  {/* 1. VISUAL FLOWCHART DIAGRAM */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <GitFork className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                        Diagram Visual Logika Alur Kerja
                      </h3>
                    </div>

                    {/* RENDER DIAGRAM (MIMICS THE USER'S ATTACHED IMAGE) */}
                    <div className="bg-slate-900 text-slate-100 rounded-xl p-5 sm:p-8 flex flex-col items-center shadow-inner overflow-x-auto print:bg-slate-50 print:text-slate-900 print:border print:border-slate-300">
                      {wf.flowchart.type === 'branching' ? (
                        <div className="w-full max-w-md flex flex-col items-center space-y-4">
                          {/* Node 1: Start */}
                          <div className="w-full text-center px-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-lg text-xs sm:text-sm font-semibold shadow-md print:bg-white print:border-slate-400">
                            {wf.flowchart.start}
                          </div>

                          {/* Arrow Down */}
                          <ArrowDown className="w-4 h-4 text-blue-400 animate-pulse print:text-slate-600" />

                          {/* Node 2: Initial Status */}
                          <div className="w-full text-center p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs shadow-md print:bg-white print:border-slate-400">
                            <div className="font-bold text-blue-300 print:text-blue-700">
                              {wf.flowchart.initialStatus.title}
                            </div>
                            <div className="text-slate-300 text-[11px] mt-0.5 print:text-slate-600">
                              {wf.flowchart.initialStatus.subtitle}
                            </div>
                          </div>

                          {/* Arrow Down */}
                          <ArrowDown className="w-4 h-4 text-blue-400 print:text-slate-600" />

                          {/* Node 3: Decision Diamond */}
                          <div className="relative flex items-center justify-center my-2">
                            <div className="w-40 h-40 sm:w-48 sm:h-48 rotate-45 bg-indigo-950/80 border-2 border-indigo-500/70 rounded-xl shadow-lg flex items-center justify-center p-3 print:bg-slate-100 print:border-indigo-600">
                              <div className="-rotate-45 text-center text-xs font-bold text-indigo-100 max-w-[130px] print:text-slate-900">
                                {wf.flowchart.decision}
                              </div>
                            </div>
                          </div>

                          {/* Branches (2 Columns) */}
                          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            {wf.flowchart.branches.map((b, bIdx) => (
                              <div
                                key={bIdx}
                                className="flex flex-col items-center p-3 bg-slate-800/90 border border-slate-700 rounded-lg text-center space-y-1.5 shadow-md print:bg-white print:border-slate-400"
                              >
                                <span className="text-[11px] font-bold text-indigo-300 print:text-indigo-700">
                                  {b.name}
                                </span>
                                <div className="text-xs font-semibold text-white print:text-slate-900">
                                  {b.step}
                                </div>
                                <div className="text-[10px] text-slate-400 print:text-slate-600">
                                  {b.desc}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Merged Arrow Down */}
                          <ArrowDown className="w-4 h-4 text-emerald-400 print:text-slate-600" />

                          {/* Action Node */}
                          <div className="w-full p-4 bg-emerald-950/40 border border-emerald-500/60 rounded-xl text-xs space-y-1.5 shadow-md print:bg-emerald-50 print:border-emerald-600">
                            <div className="font-mono font-bold text-emerald-400 text-center print:text-emerald-800">
                              {wf.flowchart.action.fn}
                            </div>
                            <ul className="space-y-1 text-slate-200 print:text-slate-800 text-[11px] list-disc list-inside">
                              {wf.flowchart.action.items.map((it, itIdx) => (
                                <li key={itIdx}>{it}</li>
                              ))}
                            </ul>
                          </div>

                          {/* Arrow Down */}
                          <ArrowDown className="w-4 h-4 text-emerald-400 print:text-slate-600" />

                          {/* End Node */}
                          <div className="w-full text-center p-3.5 bg-slate-800 border-2 border-emerald-500/60 rounded-xl text-xs shadow-md print:bg-white print:border-emerald-600">
                            <div className="font-bold text-emerald-300 text-sm print:text-emerald-700">
                              {wf.flowchart.end.title}
                            </div>
                            <div className="text-slate-300 text-xs mt-0.5 print:text-slate-600">
                              {wf.flowchart.end.subtitle}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Linear Workflow Diagram */
                        <div className="w-full max-w-md flex flex-col items-center space-y-3">
                          {wf.flowchart.steps.map((st, stIdx) => (
                            <div key={stIdx} className="w-full flex flex-col items-center">
                              <div className="w-full p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl text-center space-y-1 shadow-md print:bg-white print:border-slate-400">
                                <div className="text-xs sm:text-sm font-bold text-blue-300 print:text-blue-700">
                                  {st.title}
                                </div>
                                <div className="text-[11px] text-slate-300 print:text-slate-600">
                                  {st.desc}
                                </div>
                              </div>
                              {stIdx < wf.flowchart.steps.length - 1 && (
                                <ArrowDown className="w-4 h-4 my-2 text-blue-400 print:text-slate-600" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. TABEL LANGKAH SOP & AKTOR */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                        Rincian Langkah Kerja Operasional (SOP)
                      </h3>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3.5 w-28">Tahapan</th>
                            <th className="py-2.5 px-3.5 w-36">Aktor / Role</th>
                            <th className="py-2.5 px-3.5">Input & Syarat</th>
                            <th className="py-2.5 px-3.5">Aksi Sistem & Otomasi</th>
                            <th className="py-2.5 px-3.5">Dokumen / Hasil</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {wf.sopSteps.map((s, sIdx) => (
                            <tr key={sIdx} className="hover:bg-slate-50/60">
                              <td className="py-2.5 px-3.5 font-bold text-slate-900">{s.step}</td>
                              <td className="py-2.5 px-3.5 font-medium text-blue-700">{s.actor}</td>
                              <td className="py-2.5 px-3.5 text-slate-600">{s.input}</td>
                              <td className="py-2.5 px-3.5 text-slate-700">{s.systemAction}</td>
                              <td className="py-2.5 px-3.5 font-semibold text-emerald-700">
                                {s.output}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 3. ATURAN BISNIS & INTEGRASI AKUNTANSI */}
                  <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-4 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-blue-900">
                      <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Aturan Bisnis & Integrasi Akuntansi Otomatis:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-700">
                      {wf.businessRules.map((r, rIdx) => (
                        <li key={rIdx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER INFORMASI IMPLEMENTASI */}
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-3 print:border-none print:bg-transparent">
        <HelpCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 print:hidden" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            Catatan untuk Pengguna & Implementator Sistem:
          </p>
          <p>
            Seluruh diagram alur di atas telah diprogram secara otomatis pada sistem backend
            SyntesiaERP. Staf operasional gudang dan penjualan tidak perlu menginput debit/kredit
            akuntansi secara manual karena sistem menjalankan *Automated Double-Entry Ledger* di balik
            layar setiap kali transaksi fisik selesai dieksekusi.
          </p>
        </div>
      </div>
    </div>
  );
}

