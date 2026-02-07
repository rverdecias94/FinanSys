/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useEffect, useState } from 'react'
import Flatpickr from 'react-flatpickr'
import { Spanish } from 'flatpickr/dist/l10n/es.js'
import 'flatpickr/dist/flatpickr.css'
import '@/styles/flatpickr-theme.css'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

const Calendar = React.forwardRef(({
  className,
  value,
  onChange,
  placeholder = "Selecciona una fecha",
  disabled = false,
  eventDates,
  options,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const flatpickrRef = useRef(null)
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

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (wrapperRef.current?.contains(target)) return
      if (target.closest('.flatpickr-calendar')) return
      setIsOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleDateChange = (selectedDates) => {
    if (selectedDates.length > 0 && onChange) {
      onChange(selectedDates[0])
    } else if (onChange) {
      onChange(null)
    }
    setIsOpen(false)
  }

  const formatDate = (date) => {
    if (!date) return placeholder
    return format(date, 'PPP', { locale: es })
  }

  const toggleCalendar = () => {
    if (disabled) return
    setIsOpen((v) => !v)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant={"outline"}
        className={cn(
          "w-full justify-start text-left font-normal gap-2 mt-2",
          !value && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={toggleCalendar}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        type="button"
        ref={ref}
      >
        <span className="truncate">{value ? formatDate(value) : placeholder}</span>
        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))]"
        >
          <Flatpickr
            ref={flatpickrRef}
            value={value}
            onChange={handleDateChange}
            options={{
              locale: Spanish,
              dateFormat: 'Y-m-d',
              inline: true,
              allowInput: false,
              disableMobile: true,
              maxDate: new Date(),
              time_24hr: true,
              onDayCreate: (_dObj, _dStr, fp, dayElem) => {
                if (!eventDateSet) return
                const date = dayElem.dateObj
                if (!date) return
                const key = format(date, 'yyyy-MM-dd')
                if (eventDateSet.has(key)) dayElem.classList.add('has-event')
              },
              ...options,
            }}
            render={(_props, refInput) => (
              <input ref={refInput} className="sr-only" aria-hidden="true" tabIndex={-1} />
            )}
          />
        </div>
      )}
    </div>
  )
})


Calendar.displayName = 'Calendar'

export { Calendar }
