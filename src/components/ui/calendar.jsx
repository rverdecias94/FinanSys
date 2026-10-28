/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Flatpickr from 'react-flatpickr'
import { Spanish } from 'flatpickr/dist/l10n/es.js'
import 'flatpickr/dist/flatpickr.css'
import '@/styles/flatpickr-theme.css'
import { cn } from '@/lib/utils'
import { format, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const POPOVER_WIDTH = 320
const POPOVER_EST_HEIGHT = 360

const Calendar = React.forwardRef(({
  className,
  value,
  onChange,
  placeholder = 'Selecciona una fecha',
  disabled = false,
  eventDates,
  options,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const wrapperRef = useRef(null)
  const popoverRef = useRef(null)

  const eventDateSet = useMemo(() => {
    if (!eventDates || !Array.isArray(eventDates)) return null
    const set = new Set()
    for (const d of eventDates) {
      if (!d) continue
      if (typeof d === 'string') {
        set.add(d.slice(0, 10))
        continue
      }
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        set.add(format(d, 'yyyy-MM-dd'))
      }
    }
    return set
  }, [eventDates])

  const updatePosition = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = POPOVER_WIDTH
    const popH = popoverRef.current?.offsetHeight || POPOVER_EST_HEIGHT
    const gap = 8
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    // Preferir abajo; solo subir si abajo no cabe del todo y arriba ofrece más sitio.
    const openUp = spaceBelow < popH - 8 && spaceAbove > spaceBelow && spaceAbove >= popH * 0.85
    let left = rect.left
    left = Math.min(left, window.innerWidth - width - 12)
    left = Math.max(12, left)
    let top = openUp ? rect.top - popH - gap : rect.bottom + gap
    // Mantener el popover completo dentro del viewport (sin recortar).
    top = Math.min(top, window.innerHeight - popH - 12)
    top = Math.max(12, top)
    setCoords({ top, left })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    // Re-medir con la altura real del popover tras el primer paint.
    const raf = requestAnimationFrame(() => updatePosition())
    const handlePointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (wrapperRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      // Clics en flechas / días del calendario (SVG incluido) no cierran el popover.
      if (target.closest('.flatpickr-calendar, .flatpickr-prev-month, .flatpickr-next-month, .flatpickr-months')) return
      setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, updatePosition])

  const handleDateChange = (selectedDates) => {
    if (selectedDates.length > 0 && onChange) {
      onChange(selectedDates[0])
    } else if (onChange) {
      onChange(null)
    }
    setIsOpen(false)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    if (onChange) onChange(null)
    setIsOpen(false)
  }

  const formatDate = (date) => {
    if (!date) return placeholder
    const d = date instanceof Date ? date : new Date(date)
    if (!isValid(d)) return placeholder
    return format(d, 'PPP', { locale: es })
  }

  const toggleCalendar = () => {
    if (disabled) return
    setIsOpen((v) => !v)
  }

  const popover = isOpen
    ? createPortal(
      <div
        ref={popoverRef}
        className="pointer-events-auto fixed z-[9999] overflow-visible rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
        style={{ top: coords.top, left: coords.left, width: POPOVER_WIDTH }}
        // Radix Dialog pone pointer-events:none en el body; sin esto las flechas/días no reciben clic.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Flatpickr
          value={value}
          onChange={handleDateChange}
          options={{
            locale: Spanish,
            dateFormat: 'Y-m-d',
            inline: true,
            allowInput: false,
            disableMobile: true,
            time_24hr: true,
            static: true,
            // Evita el <select> nativo (texto claro sobre fondo claro en oscuro).
            monthSelectorType: 'static',
            onDayCreate: (_dObj, _dStr, fp, dayElem) => {
              if (!eventDateSet) return
              const date = dayElem.dateObj
              if (!date) return
              const key = format(date, 'yyyy-MM-dd')
              if (eventDateSet.has(key)) dayElem.classList.add('has-event')
            },
            // Por defecto no se puede elegir futuro; pasar maxDate: null para liberarlo.
            maxDate: options && Object.prototype.hasOwnProperty.call(options, 'maxDate')
              ? options.maxDate
              : new Date(),
            ...options,
          }}
          render={(_props, refInput) => (
            <input ref={refInput} className="sr-only" aria-hidden="true" tabIndex={-1} />
          )}
        />
      </div>,
      document.body
    )
    : null

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="outline"
        className={cn(
          'w-full justify-start text-left font-normal gap-2',
          !value && 'text-muted-foreground',
          className
        )}
        disabled={disabled}
        onClick={toggleCalendar}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        type="button"
        ref={ref}
      >
        <CalendarIcon className="h-4 w-4 opacity-50" />
        <span className="truncate flex-1">{formatDate(value)}</span>
        {value && !disabled && (
          <div
            role="button"
            tabIndex={0}
            className="ml-auto rounded-full p-1 hover:bg-muted"
            onClick={handleClear}
          >
            <X className="h-4 w-4 opacity-50 hover:opacity-100" />
          </div>
        )}
      </Button>
      {popover}
    </div>
  )
})

Calendar.displayName = 'Calendar'

export { Calendar }
