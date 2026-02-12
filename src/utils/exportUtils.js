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

/**
 * Export data to Excel
 * @param {string} sheetName - Name of the worksheet
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - Output filename (without extension)
 */
export const exportToExcel = (sheetName, data, filename) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' })
  saveAs(dataBlob, `${filename}.xlsx`)
}
