import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'
import { loadLogoAsPng, buildCompanyLines } from './reportBranding'

/**
 * Export data to PDF
 * @param {string} title - Report title
 * @param {Array<string>} headers - Table headers
 * @param {Array<Array>} data - Table rows
 * @param {string} filename - Output filename (without extension)
 * @param {Object} [options]
 * @param {Object} [options.company] - Perfil del negocio (tradeName, legalName, taxId, phone, email, logoUrl)
 * @param {boolean} [options.branding] - Si true, dibuja el membrete con logo + datos del negocio (premium)
 * @param {boolean} [options.watermark] - Si true, dibuja la marca de agua del plan free
 */
export const exportToPDF = async (title, headers, data, filename, options = {}) => {
  const { company = null, branding = false, watermark = false } = options
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let cursorY = 22

  // Membrete del negocio (premium / custom_branding): logo + identificación
  if (branding && company) {
    const { name, lines } = buildCompanyLines(company)
    let textX = 14
    if (company.logoUrl) {
      const logo = await loadLogoAsPng(company.logoUrl)
      if (logo) {
        const logoH = 18
        const logoW = Math.min(42, (logo.width / logo.height) * logoH)
        try { doc.addImage(logo.dataUrl, 'PNG', 14, 12, logoW, logoH) } catch { /* logo no embebible: se omite */ }
        textX = 14 + logoW + 6
      }
    }
    doc.setFontSize(15); doc.setFont(undefined, 'bold')
    if (name) doc.text(name, textX, 19)
    doc.setFont(undefined, 'normal'); doc.setFontSize(9); doc.setTextColor(110)
    lines.forEach((ln, i) => doc.text(ln, textX, 25 + i * 5))
    doc.setTextColor(0)
    cursorY = Math.max(34, 25 + lines.length * 5) + 6
    doc.setDrawColor(210); doc.line(14, cursorY - 5, pageWidth - 14, cursorY - 5)
  }

  // Título + fecha de emisión
  doc.setFontSize(16); doc.setFont(undefined, 'bold')
  doc.text(title, 14, cursorY)
  doc.setFont(undefined, 'normal'); doc.setFontSize(10); doc.setTextColor(110)
  doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, cursorY + 6)
  doc.setTextColor(0)

  // Table
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: cursorY + 12,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 }
  })

  // Marca de agua (plan free / watermark): texto diagonal gris claro sobre cada página
  if (watermark) {
    const pageCount = doc.internal.getNumberOfPages()
    const pageHeight = doc.internal.pageSize.getHeight()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setTextColor(224)
      doc.setFontSize(38)
      doc.text('GESTIA · PLAN GRATUITO', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 })
    }
    doc.setTextColor(0)
  }

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
