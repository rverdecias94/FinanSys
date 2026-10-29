/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, FileUp, ImageIcon, Loader2, Trash2, Import, Plus, ChevronDown, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/hooks/useSession'
import { useBusiness } from '@/context/BusinessContext'
import { useCurrency } from '@/context/CurrencyContext'
import { extractDocumentFromText, readPlainTextFile, ocrImageToText } from '@/services/aiTools'
import { createTransaction } from '@/services/finanzas'
import { createProduct } from '@/services/almacen'
import { ExampleChips } from '@/components/herramientas/ExampleChips'

const DOC_EXAMPLES = [
  {
    id: 'doc-internet',
    label: 'Factura internet 45 USD',
    text: `Factura #452 — 12/03/2026
Servicio de internet — 45.00 USD
Proveedor: ETECSA
Categoría: Servicios Públicos`,
  },
  {
    id: 'doc-venta',
    label: 'Venta servicio 120 USD',
    text: `Recibo de cobro #88 — 15/03/2026
Cliente: María López
Consultoría contable — 120.00 USD
Tipo: ingreso · Categoría: Servicios`,
  },
  {
    id: 'doc-compra',
    label: 'Compra insumos 78.50 USD',
    text: `Ticket #991 — 20/03/2026
Proveedor: Papelería Centro
Resmas y toner — 78.50 USD
Tipo: gasto · Categoría: Suministros
Producto: Toner HP · Cantidad: 2 · Precio unitario: 25`,
  },
  {
    id: 'doc-alquiler',
    label: 'Alquiler local 200 USD',
    text: `Comprobante de pago — 01/04/2026
Alquiler local comercial — 200.00 USD
Proveedor: Inmobiliaria Norte
Tipo: gasto · Categoría: Alquiler`,
  },
]

const CATEGORIES = [
  'Ventas', 'Servicios', 'Otros Ingresos',
  'Alquiler', 'Servicios Públicos', 'Transporte', 'Alimentación',
  'Tecnología', 'Marketing', 'Nómina', 'Impuestos',
  'Mantenimiento', 'Suministros', 'Seguros', 'Otros Gastos',
]

function emptyRow() {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    currency: 'USD',
    type: 'expense',
    category: 'Otros Gastos',
    description: '',
    contact_name: '',
    product_name: '',
    unit_price: '',
    quantity: '',
    selected: true,
    create_product: false,
  }
}

function normalizeRow(raw, fallbackCurrency) {
  const type = raw?.type === 'income' ? 'income' : 'expense'
  const amount = Number(raw?.amount)
  return {
    id: crypto.randomUUID(),
    date: (raw?.date && String(raw.date).slice(0, 10)) || new Date().toISOString().slice(0, 10),
    amount: Number.isFinite(amount) ? String(amount) : '',
    currency: (raw?.currency || fallbackCurrency || 'USD').toUpperCase(),
    type,
    category: CATEGORIES.includes(raw?.category) ? raw.category : (type === 'income' ? 'Otros Ingresos' : 'Otros Gastos'),
    description: raw?.description || '',
    contact_name: raw?.contact_name || '',
    product_name: raw?.product_name || '',
    unit_price: raw?.unit_price != null && Number.isFinite(Number(raw.unit_price)) ? String(raw.unit_price) : '',
    quantity: raw?.quantity != null && Number.isFinite(Number(raw.quantity)) ? String(raw.quantity) : '',
    selected: true,
    create_product: Boolean(raw?.product_name),
  }
}

export function DocumentReader({ onQuotaChange }) {
  const { session } = useSession()
  const { businessId } = useBusiness()
  const { businessCurrencies } = useCurrency()
  const userId = session?.user?.id
  const queryClient = useQueryClient()
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const [rows, setRows] = useState([])
  const [sourceLabel, setSourceLabel] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [ocrProgress, setOcrProgress] = useState(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const baseCurrency = useMemo(
    () => businessCurrencies?.find((c) => c.is_default)?.code || businessCurrencies?.[0]?.code || 'USD',
    [businessCurrencies]
  )

  const currencyOptions = useMemo(() => {
    const codes = (businessCurrencies || []).map((c) => c.code).filter(Boolean)
    return [...new Set([baseCurrency, ...codes])]
  }, [businessCurrencies, baseCurrency])

  const extractMutation = useMutation({
    mutationFn: async ({ text, label }) => {
      return {
        data: await extractDocumentFromText({ text, businessId }),
        label: label || 'texto',
      }
    },
    onSuccess: ({ data, label }) => {
      setSourceLabel(label)
      const extracted = (data?.rows || []).map((r) => normalizeRow(r, baseCurrency))
      setRows(extracted.length ? extracted : [emptyRow()])
      onQuotaChange?.()
      toast.success(extracted.length ? `Se extrajeron ${extracted.length} fila(s)` : 'Sin filas detectadas; completa la tabla a mano')
    },
    onError: (err) => {
      toast.error('No se pudo procesar', { description: err?.message })
    },
  })

  const importMutation = useMutation({
    mutationFn: async () => {
      const selected = rows.filter((r) => r.selected)
      if (!selected.length) throw new Error('Selecciona al menos una fila')

      let txCount = 0
      let productCount = 0

      for (const row of selected) {
        const amount = Number(row.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error(`Monto inválido en: ${row.description || 'fila sin descripción'}`)
        }

        await createTransaction({
          date: row.date,
          amount,
          currency: row.currency,
          category: row.category,
          description: row.description || 'Importado desde documento',
          type: row.type,
          payment_method: 'Efectivo',
          status: 'paid',
          notes: row.contact_name ? `Contacto sugerido: ${row.contact_name}` : 'Importado con Copiloto Ultra',
        }, userId, businessId)
        txCount += 1

        if (row.create_product && row.product_name?.trim()) {
          await createProduct({
            name: row.product_name.trim(),
            category: 'General',
            unit_price: Number(row.unit_price) || amount,
            stock: Number(row.quantity) || 0,
            currency: row.currency,
            min_stock: 0,
          }, userId, businessId)
          productCount += 1
        }
      }

      return { txCount, productCount }
    },
    onSuccess: ({ txCount, productCount }) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Importado: ${txCount} transacción(es)${productCount ? `, ${productCount} producto(s)` : ''}`)
      setRows([])
      setSourceLabel('')
      setPasteText('')
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
    },
    onError: (err) => toast.error('Error al importar', { description: err?.message }),
  })

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const handleImage = async (file) => {
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      toast.error('Elige una imagen (foto del comprobante)')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setOcrBusy(true)
    setOcrProgress(0)
    try {
      const text = await ocrImageToText(file, { onProgress: setOcrProgress })
      if (!text) {
        toast.error('No se leyó texto en la foto', {
          description: 'Prueba con más luz, enfoca el ticket y vuelve a disparar.',
        })
        setPasteText('')
        return
      }
      setPasteText(text)
      toast.success('Texto leído en tu dispositivo. Revisa montos y pulsa Extraer.')
      setAdvancedOpen(true)
    } catch (err) {
      toast.error('OCR falló', { description: err?.message })
    } finally {
      setOcrBusy(false)
      setOcrProgress(null)
    }
  }

  const handleTextFile = async (file) => {
    if (!file) return
    const name = (file.name || '').toLowerCase()
    const isText = file.type?.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.md')
    if (!isText) {
      toast.error('Solo .txt / .csv en opciones avanzadas')
      return
    }
    try {
      const text = await readPlainTextFile(file)
      extractMutation.mutate({ text, label: file.name })
    } catch (err) {
      toast.error('No se pudo leer el archivo', { description: err?.message })
    }
  }

  const busy = ocrBusy || extractMutation.isPending

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Importar comprobante</CardTitle>
          <CardDescription>
            Toma una foto o elige una imagen. Se lee en tu dispositivo; tú revisas montos y luego importas a Finanzas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              La foto no se envía a un servicio de visión de pago: el texto se lee aquí (OCR local).
              Corrige cifras si el ticket está borroso antes de importar.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              size="lg"
              className="h-12"
              disabled={busy}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="mr-2 h-5 w-5" />
              Tomar foto
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="h-12"
              disabled={busy}
              onClick={() => galleryRef.current?.click()}
            >
              <ImageIcon className="mr-2 h-5 w-5" />
              Elegir imagen
            </Button>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              handleImage(f)
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              handleImage(f)
            }}
          />

          {previewUrl && (
            <div className="overflow-hidden rounded-lg border">
              <img src={previewUrl} alt="Vista previa del comprobante" className="max-h-48 w-full object-contain bg-muted/40" />
            </div>
          )}

          {ocrBusy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Leyendo texto… {ocrProgress != null ? `${ocrProgress}%` : ''}
            </p>
          )}

          {pasteText.trim() && (
            <div className="space-y-2">
              <Label htmlFor="ocr-text">Texto detectado (edítalo si hace falta)</Label>
              <Textarea
                id="ocr-text"
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                disabled={busy}
              />
              <Button
                type="button"
                disabled={busy || !pasteText.trim()}
                onClick={() => extractMutation.mutate({ text: pasteText, label: sourceLabel || 'foto / texto' })}
              >
                {extractMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Extraer filas
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-between px-2"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              Más opciones (pegar texto / .txt)
              <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </Button>
            {advancedOpen && (
              <div className="space-y-3 rounded-md border p-3">
                <ExampleChips
                  label="Ejemplos de texto"
                  examples={DOC_EXAMPLES}
                  disabled={busy}
                  onSelect={(ex) => {
                    setPasteText(ex.text)
                    setAdvancedOpen(true)
                  }}
                />
                <div className="space-y-1">
                  <Label htmlFor="doc-paste">Pegar texto</Label>
                  <Textarea
                    id="doc-paste"
                    rows={4}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={'Ej:\nFactura #452 — 45.00 USD\nProveedor: ETECSA'}
                    disabled={busy}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || !pasteText.trim()}
                    onClick={() => extractMutation.mutate({ text: pasteText, label: 'texto pegado' })}
                  >
                    Extraer desde texto
                  </Button>
                  <Input
                    type="file"
                    accept=".txt,.csv,.md,text/plain,text/csv"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      handleTextFile(file)
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {sourceLabel && (
            <p className="text-xs text-muted-foreground">Origen: {sourceLabel}</p>
          )}
          <p className="text-xs text-muted-foreground">
            El cupo de importación cuenta ~1 página cada ~2500 caracteres al extraer.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium">Revisión ({rows.filter((r) => r.selected).length} seleccionadas)</h3>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((p) => [...p, emptyRow()])}>
                <Plus className="mr-1 h-4 w-4" />
                Fila
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
                Importar seleccionadas
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.id} className={!row.selected ? 'opacity-60' : undefined}>
                <CardContent className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => updateRow(row.id, { selected: e.target.checked })}
                      className="h-4 w-4"
                      aria-label="Seleccionar fila"
                    />
                    <span className="text-xs text-muted-foreground">Incluir en importación</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-8 w-8 text-destructive"
                      onClick={() => setRows((p) => p.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label>Fecha</Label>
                    <Input type="date" value={row.date} onChange={(e) => updateRow(row.id, { date: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Moneda</Label>
                    <Select value={row.currency} onValueChange={(v) => updateRow(row.id, { currency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {currencyOptions.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Tipo</Label>
                    <Select value={row.type} onValueChange={(v) => updateRow(row.id, { type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Gasto</SelectItem>
                        <SelectItem value="income">Ingreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Categoría</Label>
                    <Select value={row.category} onValueChange={(v) => updateRow(row.id, { category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                    <Label>Descripción</Label>
                    <Input value={row.description} onChange={(e) => updateRow(row.id, { description: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Contacto (opcional)</Label>
                    <Input value={row.contact_name} onChange={(e) => updateRow(row.id, { contact_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Producto (opcional)</Label>
                    <Input value={row.product_name} onChange={(e) => updateRow(row.id, { product_name: e.target.value })} />
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.create_product}
                        onChange={(e) => updateRow(row.id, { create_product: e.target.checked })}
                        className="h-4 w-4"
                      />
                      Crear en Almacén
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!rows.length && !busy && !pasteText.trim() && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          <FileUp className="h-8 w-8 opacity-50" />
          <p>Toma una foto del ticket o factura para empezar.</p>
        </div>
      )}
    </div>
  )
}
