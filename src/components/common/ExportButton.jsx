/* eslint-disable react/prop-types */
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FORMAT_ICONS } from '@/components/icons/FileFormatIcons'

const DEFAULT_LABELS = { pdf: 'PDF', excel: 'Excel', word: 'Word' }

/**
 * Botón de exportación uniforme: icono de formato (PDF/Excel/Word) + etiqueta
 * SIEMPRE visible (en todas las pantallas) y, si el formato está bloqueado en el
 * plan, un candado junto al texto. El click se mantiene aunque esté `locked`
 * (para poder mostrar el aviso de "Premium").
 *
 * @param {'pdf'|'excel'|'word'} format
 * @param {string} [label] - texto a mostrar (por defecto el nombre del formato)
 * @param {boolean} [locked] - muestra el candado (función Premium)
 */
export function ExportButton({
  format,
  label,
  locked = false,
  onClick,
  variant = 'outline',
  size = 'sm',
  className,
  loading,
  disabled,
  ...props
}) {
  const Icon = FORMAT_ICONS[format] || FORMAT_ICONS.pdf
  const text = label || DEFAULT_LABELS[format] || 'Exportar'

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      className={className}
      loading={loading}
      disabled={disabled}
      title={locked ? `${text} es una función Premium` : undefined}
      aria-label={locked ? `${text} (Premium)` : text}
      {...props}
    >
      <Icon className="h-4 w-4" />
      <span>{text}</span>
      {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  )
}
