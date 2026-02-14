import React, { useState, useEffect } from 'react'
import {
  format, startOfDay, endOfDay, startOfMonth, endOfMonth,
  startOfYear, endOfYear, startOfQuarter, endOfQuarter,
  setMonth, setYear, setQuarter, addMonths
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"

const DateRangeFilter = ({ onFilterChange, children }) => {
  const [filterType, setFilterType] = useState('month')

  // States for different filters
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [selectedQuarter, setSelectedQuarter] = useState('1')

  const [customStart, setCustomStart] = useState(startOfMonth(new Date()))
  const [customEnd, setCustomEnd] = useState(endOfMonth(new Date()))

  // Generate years (current year +/- 5)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 11 }, (_, i) => (currentYear - 5 + i).toString())

  const months = [
    { value: '0', label: 'Enero' },
    { value: '1', label: 'Febrero' },
    { value: '2', label: 'Marzo' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Mayo' },
    { value: '5', label: 'Junio' },
    { value: '6', label: 'Julio' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Septiembre' },
    { value: '9', label: 'Octubre' },
    { value: '10', label: 'Noviembre' },
    { value: '11', label: 'Diciembre' },
  ]

  const quarters = [
    { value: '1', label: 'Primer Trimestre (Q1)' },
    { value: '2', label: 'Segundo Trimestre (Q2)' },
    { value: '3', label: 'Tercer Trimestre (Q3)' },
    { value: '4', label: 'Cuarto Trimestre (Q4)' },
  ]

  useEffect(() => {
    let start, end, label

    switch (filterType) {
      case 'day':
        if (selectedDate) {
          start = startOfDay(selectedDate)
          end = endOfDay(selectedDate)
          label = format(selectedDate, 'dd MMMM yyyy', { locale: es })
        }
        break
      case 'month':
        const dateWithMonth = setMonth(setYear(new Date(), parseInt(selectedYear)), parseInt(selectedMonth))
        start = startOfMonth(dateWithMonth)
        end = endOfMonth(dateWithMonth)
        label = format(dateWithMonth, 'MMMM yyyy', { locale: es })
        break
      case 'year':
        const dateWithYear = setYear(new Date(), parseInt(selectedYear))
        start = startOfYear(dateWithYear)
        end = endOfYear(dateWithYear)
        label = format(dateWithYear, 'yyyy')
        break
      case 'quarter':
        // Quarter is 1-indexed in UI, 1-indexed in date-fns setQuarter (but date-fns handles quarters differently, let's calculate manually to be safe or use setQuarter)
        // setQuarter(date, quarter): quarter is 1-4
        const dateWithQuarter = setQuarter(setYear(new Date(), parseInt(selectedYear)), parseInt(selectedQuarter))
        start = startOfQuarter(dateWithQuarter)
        end = endOfQuarter(dateWithQuarter)
        label = `${quarters.find(q => q.value === selectedQuarter)?.label} ${selectedYear}`
        break
      case 'custom':
        if (customStart && customEnd) {
          start = startOfDay(customStart)
          end = endOfDay(customEnd)
          label = `${format(customStart, 'dd/MM/yyyy')} - ${format(customEnd, 'dd/MM/yyyy')}`
        }
        break
    }

    if (start && end && onFilterChange) {
      onFilterChange({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        type: filterType,
        label
      })
    }
  }, [filterType, selectedDate, selectedMonth, selectedYear, selectedQuarter, customStart, customEnd])

  return (
    <div className="flex flex-wrap gap-4 items-end bg-card p-4 rounded-lg border shadow-sm">
      <div className="space-y-2">
        <Label>Tipo de Reporte</Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Día Específico</SelectItem>
            <SelectItem value="month">Mensual</SelectItem>
            <SelectItem value="quarter">Trimestral</SelectItem>
            <SelectItem value="year">Anual</SelectItem>
            <SelectItem value="custom">Rango Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filterType === 'day' && (
        <div className="space-y-2">
          <Label>Fecha</Label>
          <div className="w-[200px]">
            <Calendar value={selectedDate} onChange={setSelectedDate} />
          </div>
        </div>
      )}

      {filterType === 'month' && (
        <>
          <div className="space-y-2">
            <Label>Mes</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Año</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {filterType === 'quarter' && (
        <>
          <div className="space-y-2">
            <Label>Trimestre</Label>
            <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {quarters.map((q) => (
                  <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Año</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {filterType === 'year' && (
        <div className="space-y-2">
          <Label>Año</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filterType === 'custom' && (
        <>
          <div className="space-y-2">
            <Label>Desde</Label>
            <div className="w-[160px]">
              <Calendar value={customStart} onChange={setCustomStart} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Hasta</Label>
            <div className="w-[160px]">
              <Calendar value={customEnd} onChange={setCustomEnd} />
            </div>
          </div>
        </>
      )}

      {children && <div className="ml-auto">{children}</div>}
    </div>
  )
}

export default DateRangeFilter
