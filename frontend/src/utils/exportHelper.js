/**
 * Utility helper untuk mengunduh data tabel ke file CSV
 * @param {string} filename Nama file hasil download (tanpa extension)
 * @param {Array<string>} headers Judul kolom header
 * @param {Array<Array<any>>} data Baris data 2D
 */
export const exportToCSV = (filename, headers, data) => {
  if (!headers || !data || data.length === 0) {
    alert('Tidak ada data yang dapat diexport.');
    return;
  }

  let csvContent = '\uFEFF';
  csvContent += headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',') + '\r\n';

  data.forEach((row) => {
    const rowStr = row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',');
    csvContent += rowStr + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Utility helper untuk mengunduh data tabel ke file Excel (.xls) murni secara langsung (Tanpa dependensi npm external)
 * Format HTML Spreadsheet XML ini otomatis dibuka Microsoft Excel, LibreOffice, & WPS sebagai tabel spreadsheet berformat.
 * @param {string} filename Nama file hasil download (tanpa extension)
 * @param {Array<string>} headers Judul kolom header
 * @param {Array<Array<any>>} data Baris data 2D
 */
export const exportToExcel = (filename, headers, data) => {
  if (!headers || !data || data.length === 0) {
    alert('Tidak ada data yang dapat diexport.');
    return;
  }

  const escapeXml = (str) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // Template HTML/XML Spreadsheet kompatibel dengan Microsoft Excel 2003+
  let excelTemplate = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="content-type" content="text/html; charset=UTF-8"/>
<!--[if gte mso 9]>
<xml>
<x:ExcelWorkbook>
<x:ExcelWorksheets>
<x:ExcelWorksheet>
<x:Name>Data Rekap</x:Name>
<x:WorksheetOptions>
<x:DisplayGridlines/>
</x:WorksheetOptions>
</x:ExcelWorksheet>
</x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; }
  table { border-collapse: collapse; width: 100%; }
  th { background-color: #047857; color: #ffffff; font-weight: bold; border: 1px solid #065f46; text-align: left; padding: 8px 12px; }
  td { border: 1px solid #cbd5e1; padding: 6px 10px; color: #1e293b; mso-number-format:"\\@"; }
  tr:nth-child(even) td { background-color: #f8fafc; }
</style>
</head>
<body>
<table>
<thead>
  <tr>
    ${headers.map((h) => `<th>${escapeXml(h)}</th>`).join('')}
  </tr>
</thead>
<tbody>
  ${data
    .map(
      (row) => `<tr>${row.map((cell) => `<td>${escapeXml(cell)}</td>`).join('')}</tr>`
    )
    .join('')}
</tbody>
</table>
</body>
</html>`;

  const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Memicu fungsi cetak browser (Window Print)
 */
export const triggerPrint = () => {
  window.print();
};




