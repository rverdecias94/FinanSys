/* eslint-disable react/prop-types */
// Iconos de formato de archivo "de marca" (colores fijos por formato, legibles a
// 16px gracias a la forma además del color). Pensados para botones de exportar.
//  - PDF  → rojo, con etiqueta "PDF"
//  - Excel → verde, con una rejilla (hoja de cálculo)
//  - Word → azul, con líneas de texto (documento)
// El color es intencionalmente fijo (no usa tokens) porque identifica el formato
// y debe verse igual en claro/oscuro.

const PAGE = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z'
const FOLD = 'M14 2v6h6'

export function PdfIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={PAGE} fill="#dc2626" fillOpacity="0.12" stroke="#dc2626" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={FOLD} stroke="#dc2626" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="6.5" y="12.5" width="11" height="5.5" rx="1" fill="#dc2626" />
      <text x="12" y="16.6" textAnchor="middle" fontSize="3.8" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">PDF</text>
    </svg>
  )
}

export function ExcelIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={PAGE} fill="#16a34a" fillOpacity="0.12" stroke="#16a34a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={FOLD} stroke="#16a34a" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="7" y="12" width="10" height="7" rx="1" stroke="#16a34a" strokeWidth="1.2" />
      <path d="M7 15.5h10M12 12v7" stroke="#16a34a" strokeWidth="1.2" />
    </svg>
  )
}

export function WordIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={PAGE} fill="#2563eb" fillOpacity="0.12" stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={FOLD} stroke="#2563eb" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 13h9M7.5 15.5h9M7.5 18h6" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export const FORMAT_ICONS = { pdf: PdfIcon, excel: ExcelIcon, word: WordIcon }
