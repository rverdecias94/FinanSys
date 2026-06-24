import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReportPreview } from './ReportPreview'

// Documenta CÓMO debe verse el documento que se previsualiza/descarga:
// membrete con los datos del negocio (Configuración), título/metadatos, tablas con
// participación (no icono), cifras alineadas a la derecha y colores fijos aptos para
// el papel blanco en modo claro y oscuro.

const baseReport = {
  title: 'Resumen financiero del período',
  metadata: [
    { label: 'Período analizado', value: 'Junio 2026' },
    { label: 'Moneda', value: 'USD' }
  ],
  sections: [
    { title: '1. Resumen Ejecutivo', content: 'Texto del resumen ejecutivo.' },
    {
      title: '2. Desglose por Área',
      type: 'table',
      headers: ['Área', 'Ítems registrados', 'Participación'],
      rows: [
        ['Almacén Central', '30', '75.0%'],
        ['Total', '40', '100.0%']
      ],
      notes: 'La participación es el porcentaje de los ítems registrados que concentra cada área.'
    },
    { title: '3. Conclusiones', type: 'list', items: ['**Resultado:** positivo'] }
  ]
}

const company = {
  tradeName: 'Mi Negocio SA',
  legalName: 'Mi Negocio Sociedad Anónima',
  taxId: 'J-12345678',
  phone: '+53 5555 5555',
  email: 'hola@minegocio.com'
}

describe('ReportPreview — membrete con datos del negocio', () => {
  it('muestra nombre, identificación fiscal y contacto del negocio (Configuración)', () => {
    render(<ReportPreview report={baseReport} company={company} />)
    expect(screen.getByText('Mi Negocio SA')).toBeInTheDocument()
    expect(screen.getByText(/NIT \/ ID fiscal: J-12345678/)).toBeInTheDocument()
    expect(screen.getByText(/hola@minegocio\.com/)).toBeInTheDocument()
  })

  it('sin datos del negocio no muestra membrete pero sí el informe', () => {
    render(<ReportPreview report={baseReport} company={null} />)
    expect(screen.queryByText('Mi Negocio SA')).toBeNull()
    expect(screen.getByText('Resumen financiero del período')).toBeInTheDocument()
  })
})

describe('ReportPreview — contenido del informe', () => {
  it('renderiza título, metadatos, tablas y listas', () => {
    render(<ReportPreview report={baseReport} company={company} />)
    expect(screen.getByRole('heading', { name: /Resumen financiero del período/i })).toBeInTheDocument()
    expect(screen.getByText('Período analizado:')).toBeInTheDocument()
    expect(screen.getByText('Junio 2026')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Participación' })).toBeInTheDocument()
    expect(screen.getByText('Resultado:')).toBeInTheDocument() // **bold** convertido a <strong>
  })

  it('ya no expone una columna de Icono', () => {
    render(<ReportPreview report={baseReport} company={company} />)
    expect(screen.queryByRole('columnheader', { name: /Icono/i })).toBeNull()
  })

  it('devuelve null si no hay informe', () => {
    const { container } = render(<ReportPreview report={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ReportPreview — apariencia (pixel/legibilidad)', () => {
  it('alinea las cifras a la derecha y sin partir (whitespace-nowrap)', () => {
    render(<ReportPreview report={baseReport} company={company} />)
    const cell = screen.getByText('75.0%')
    expect(cell.className).toMatch(/text-right/)
    expect(cell.className).toMatch(/whitespace-nowrap/)
  })

  it('el texto se alinea a la izquierda (nombres de área)', () => {
    render(<ReportPreview report={baseReport} company={company} />)
    const cell = screen.getByRole('cell', { name: 'Almacén Central' })
    expect(cell.className).toMatch(/text-left/)
  })

  it('usa colores fijos (no tokens de tema) para legibilidad sobre papel blanco', () => {
    render(<ReportPreview report={baseReport} company={company} />)
    // En modo oscuro, text-muted-foreground sería gris claro ilegible sobre blanco.
    const note = screen.getByText(/La participación es el porcentaje/)
    expect(note.className).toMatch(/text-gray-500/)
    expect(note.className).not.toMatch(/text-muted-foreground/)
  })
})
