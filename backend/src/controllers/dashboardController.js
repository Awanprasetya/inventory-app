const dashboardModel = require('../models/dashboardModel');
const { asyncHandler } = require('../middleware/errorHandler');
const { getTenantId } = require('../utils/tenantHelper');

const formatLocalDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// GET /api/dashboard/summary
const summary = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const [stats, lowStock, dueDates] = await Promise.all([
    dashboardModel.getSummary(tenantId),
    dashboardModel.getLowStock(tenantId, 10, 8),
    dashboardModel.getUpcomingDueDates(tenantId, 10),
  ]);

  res.json({
    success: true,
    data: {
      total_produk: Number(stats.total_produk),
      total_stok: Number(stats.total_stok),
      masuk_hari_ini: Number(stats.masuk_hari_ini),
      keluar_hari_ini: Number(stats.keluar_hari_ini),
      stok_habis: Number(stats.stok_habis),
      stok_menipis: lowStock,
      total_utang_aktif: Number(stats.total_utang_aktif),
      total_utang_overdue: Number(stats.total_utang_overdue),
      count_utang_overdue: Number(stats.count_utang_overdue),
      total_piutang_aktif: Number(stats.total_piutang_aktif),
      total_piutang_overdue: Number(stats.total_piutang_overdue),
      count_piutang_overdue: Number(stats.count_piutang_overdue),
      upcoming_due: dueDates,
    },
  });
});

// GET /api/dashboard/due-dates
const dueDates = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const limit = req.query.limit ? Number(req.query.limit) : 10;
  const data = await dashboardModel.getUpcomingDueDates(tenantId, limit);
  res.json({ success: true, data });
});

// GET /api/dashboard/chart -> 7 hari terakhir
const chart = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const rows = await dashboardModel.getChart(tenantId);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ tanggal: formatLocalDate(d), masuk: 0, keluar: 0 });
  }

  for (const row of rows) {
    const slot = days.find((d) => d.tanggal === row.tanggal);
    if (!slot) continue;
    if (row.tipe === 'MASUK') slot.masuk = Number(row.total);
    else slot.keluar = Number(row.total);
  }

  res.json({ success: true, data: days });
});

module.exports = { summary, dueDates, chart };
