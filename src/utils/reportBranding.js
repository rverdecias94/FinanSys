// Helpers compartidos para el branding de documentos (PDF/DOCX) de Reportes.
// Fase 1 premium: membrete con logo + datos del negocio (custom_branding) y
// marca de agua para el plan free (watermark).

/**
 * Carga un logo desde una URL y lo rasteriza a PNG vía <canvas>, devolviendo lo
 * que necesitan jsPDF (dataUrl) y docx (Uint8Array) + dimensiones naturales.
 * - Soporta PNG y SVG (el SVG se rasteriza al dibujarlo en el canvas).
 * - Si falla (CORS, error de carga), devuelve null → el documento se genera SIN
 *   logo en vez de romperse (degradación elegante).
 */
export async function loadLogoAsPng(url) {
  if (!url || typeof document === 'undefined') return null
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })

    const w = img.naturalWidth || 240
    const h = img.naturalHeight || 240
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)

    const dataUrl = canvas.toDataURL('image/png')
    const base64 = dataUrl.split(',')[1]
    const binary = atob(base64)
    const uint8 = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i)

    return { dataUrl, uint8, width: w, height: h }
  } catch {
    return null
  }
}

/**
 * Construye el nombre principal y las líneas de identificación del negocio para
 * el membrete de los documentos, a partir del objeto `company` de
 * business_settings ({ tradeName, legalName, taxId, phone, email }).
 */
export function buildCompanyLines(company) {
  if (!company || typeof company !== 'object') return { name: '', lines: [] }
  const name = company.tradeName || company.legalName || ''
  const lines = []
  if (company.legalName && company.legalName !== name) lines.push(company.legalName)
  if (company.taxId) lines.push(`NIT / ID fiscal: ${company.taxId}`)
  const contact = [company.phone, company.email].filter(Boolean).join('   ·   ')
  if (contact) lines.push(contact)
  return { name, lines }
}
