import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'

/**
 * Export data to PDF
 * @param {string} title - Report title
 * @param {Array<string>} headers - Table headers
 * @param {Array<Array>} data - Table rows
 * @param {string} filename - Output filename (without extension)
 */
export const exportToPDF = (title, headers, data, filename) => {
  const doc = new jsPDF()

  // Title
  doc.setFontSize(18)
  doc.text(title, 14, 22)
  doc.setFontSize(11)
  doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30)

  // Table
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 35,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 }
  })

  doc.save(`${filename}.pdf`)
}

// Caracteres con los que una celda podría interpretarse como fórmula al abrir
// el archivo en Excel/Sheets (CSV/Excel formula injection): = + - @ tab CR.
const FORMULA_PREFIX = /^[=+\-@\t\r]/

/**
 * Neutraliza la inyección de fórmulas en celdas de texto. Antepone una comilla
 * simple a los valores de texto que empiezan con un carácter peligroso, salvo
 * que el valor sea un número legítimo (p. ej. un importe negativo "-25.50"),
 * que se deja intacto para no romper los montos.
 */
export const sanitizeCellValue = (value) => {
  if (typeof value !== 'string' || value.length === 0) return value
  if (value.trim() !== '' && !Number.isNaN(Number(value))) return value
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

const sanitizeRow = (row) => {
  if (!row || typeof row !== 'object') return row
  return Object.fromEntries(
    Object.entries(row).map(([key, val]) => [key, sanitizeCellValue(val)])
  )
}

/**
 * Export data to Excel
 * @param {string} sheetName - Name of the worksheet
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - Output filename (without extension)
 */
export const exportToExcel = (sheetName, data, filename) => {
  const safeData = Array.isArray(data) ? data.map(sanitizeRow) : data
  const ws = XLSX.utils.json_to_sheet(safeData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' })
  saveAs(dataBlob, `${filename}.xlsx`)
}
