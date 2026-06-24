/* eslint-disable react/prop-types */
import { buildCompanyLines } from '@/utils/reportBranding'

// ¿La celda es un número (importe, cantidad, porcentaje)? Se alinea a la derecha y
// no se parte, para que las cifras se lean de un vistazo. El texto se alinea a la
// izquierda y puede ajustar (wrap) para no desbordar en móvil. Exige al menos un
// dígito: si no, una celda de texto se vaciaría a '' y Number('') === 0 la trataría
// como numérica por error (y la alinearía a la derecha).
const isNumericCell = (cell) => {
  const s = String(cell ?? '').trim()
  if (s === '' || !/\d/.test(s)) return false
  const cleaned = s.replace(/[^0-9.,-]+/g, '').replace(/,/g, '')
  return cleaned !== '' && !isNaN(cleaned)
}

/**
 * Previsualización del informe tal como se descargará (membrete del negocio +
 * secciones). El documento es una "hoja" blanca SIEMPRE (modo claro y oscuro), por
 * eso usa colores fijos (gray/emerald/black) en vez de tokens del tema: un token
 * como `text-muted-foreground` se volvería gris claro ilegible sobre el papel blanco
 * en modo oscuro.
 *
 * @param {Object} props.report  - objeto estructurado del narrativeGenerator
 * @param {Object} [props.company] - perfil del negocio (Configuración) para el membrete
 */
export const ReportPreview = ({ report, company = null }) => {
  if (!report) return null

  const { name: companyName, lines: companyLines } = buildCompanyLines(company)
  const hasLetterhead = Boolean(companyName || company?.logoUrl)

  return (
    <div className="min-w-0 space-y-6 font-serif text-sm">
      {/* Membrete del negocio (datos generales de Configuración) */}
      {hasLetterhead && (
        <div className="flex flex-col items-center gap-2 border-b pb-4 text-center">
          {company?.logoUrl && (
            <img
              src={company.logoUrl}
              alt={companyName || 'Logo del negocio'}
              className="h-12 w-auto max-w-[160px] object-contain"
            />
          )}
          {companyName && <p className="text-base font-bold tracking-wide text-black">{companyName}</p>}
          {companyLines.length > 0 && (
            <p className="break-words text-[11px] leading-relaxed text-gray-500">
              {companyLines.join('  ·  ')}
            </p>
          )}
        </div>
      )}

      {/* Título + metadatos */}
      <div className="space-y-2 border-b pb-4 text-center">
        <h2 className="break-words text-xl font-bold uppercase tracking-wide sm:text-2xl">{report.title}</h2>
        {report.metadata && (
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-1 text-left text-xs text-gray-500 sm:grid-cols-2">
            {report.metadata.map((m, i) => (
              <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <span className="shrink-0 font-bold sm:min-w-[120px]">{m.label}:</span>
                <span className="break-words">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Secciones */}
      {report.sections.map((section, idx) => (
        <div key={idx} className="min-w-0 space-y-3">
          {section.title && (
            <h3
              className={
                section.type === 'header_section'
                  ? 'mt-8 break-words border-b-2 border-black pb-2 text-center text-lg font-bold sm:text-xl'
                  : 'mt-4 break-words text-base font-bold text-emerald-700 sm:text-lg'
              }
            >
              {section.title}
            </h3>
          )}

          {(!section.type || section.type === 'paragraph') && (
            <p className="whitespace-pre-wrap break-words text-justify leading-relaxed">{section.content}</p>
          )}

          {section.type === 'table' && (
            <div className="my-4 overflow-x-auto rounded-sm border">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {section.headers.map((h, i) => (
                      <th key={i} className="border-b px-2 py-2 text-center font-bold sm:px-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className={`px-2 py-2 sm:px-3 ${isNumericCell(cell) ? 'whitespace-nowrap text-right' : 'text-left'}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {section.notes && (
                <p className="border-t bg-gray-50 p-2 text-[11px] italic text-gray-500">{section.notes}</p>
              )}
            </div>
          )}

          {section.type === 'list' && (
            <ul className="list-disc space-y-1 pl-5 marker:text-gray-400">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className="break-words"
                  dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

export default ReportPreview
