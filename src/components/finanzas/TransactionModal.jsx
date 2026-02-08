/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Upload, Check, X, Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

const DEFAULT_CATEGORIES = {
  income: [
    'Ventas', 'Servicios Profesionales', 'Inversiones', 'Reembolsos',
    'Consultoría', 'Licencias', 'Dividendos', 'Alquileres',
    'Comisiones', 'Subvenciones', 'Intereses', 'Otros'
  ],
  expense: [
    'Servicios', 'Suministros', 'Transporte', 'Alimentación',
    'Tecnología', 'Marketing', 'Nómina', 'Impuestos',
    'Mantenimiento', 'Seguros', 'Alquiler', 'Capacitación',
    'Software', 'Mobiliario', 'Otros'
  ]
}

const DEFAULT_PAYMENT_METHODS = [
  'Efectivo', 'Transferencia Bancaria', 'Tarjeta de Débito',
  'Tarjeta de Crédito', 'Cheque', 'Depósito Bancario',
  'PayPal', 'Zelle', 'Otro'
]

const formSchema = z.object({
  type: z.enum(['income', 'expense']),
  date: z.date({ required_error: "La fecha es obligatoria" }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "El monto debe ser un número positivo",
  }),
  currency: z.enum(['USD', 'CUP']),
  category: z.string().min(1, "La categoría es obligatoria"),
  description: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
  notes: z.string().optional(),
  files: z.any().optional(), // For mock attachment
})

export function TransactionModal({ open, onOpenChange, onSubmit, categories, paymentMethods, transaction }) {
  const [isPreview, setIsPreview] = useState(false)
  const [files, setFiles] = useState([])
  const [existingAttachments, setExistingAttachments] = useState([])

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      date: new Date(),
      amount: '',
      currency: 'USD',
      category: '',
      description: '',
      payment_method: '',
      bank_account_id: '',
      notes: '',
    },
  })

  const isEditing = Boolean(transaction?.id)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (isEditing) {
        const details = transaction?.details || {}
        form.reset({
          type: transaction?.type || 'expense',
          date: transaction?.date ? new Date(transaction.date) : new Date(),
          amount: transaction?.amount != null ? String(transaction.amount) : '',
          currency: transaction?.currency || 'USD',
          category: transaction?.category || '',
          description: transaction?.description || '',
          payment_method: details.payment_method || '',
          bank_account_id: details.bank_account_id ? String(details.bank_account_id) : '',
          notes: details.notes || '',
        })

        const attachments = Array.isArray(details.attachments) ? details.attachments.filter(Boolean) : []
        setExistingAttachments(attachments)
      } else {
        form.reset()
        setExistingAttachments([])
      }
      setIsPreview(false)
      setFiles([])
    }
  }, [open, form, isEditing, transaction])

  const watchedValues = form.watch()

  // Use props if available, otherwise fallback to defaults
  const availableCategories = categories && categories[watchedValues.type]?.length > 0
    ? categories[watchedValues.type]
    : DEFAULT_CATEGORIES[watchedValues.type]

  const categoryOptions = Array.from(
    new Set([watchedValues.category, ...(availableCategories || [])].filter(Boolean))
  )

  const availablePaymentMethods = paymentMethods && paymentMethods.length > 0
    ? paymentMethods
    : DEFAULT_PAYMENT_METHODS

  const paymentMethodOptions = Array.from(
    new Set([watchedValues.payment_method, ...(availablePaymentMethods || [])].filter(Boolean))
  )

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const removeExistingAttachment = (attachment) => {
    setExistingAttachments((prev) => prev.filter((a) => a !== attachment))
  }

  const handleSubmit = (data) => {
    if (!isPreview) {
      setIsPreview(true)
      return
    }
    // Final submit
    const mergedAttachments = [...existingAttachments, ...files.map((f) => f.name)]
    const payload = {
      ...data,
      id: transaction?.id,
      amount: Number(data.amount),
      attachments: mergedAttachments // Mock file storage
    }
    onSubmit(payload)
  }

  const calculateTotal = () => {
    const amount = Number(watchedValues.amount || 0)
    return amount
  }

  const isViewableUrl = (value) =>
    typeof value === 'string' && (/^https?:\/\//i.test(value) || /^data:image\//i.test(value))

  const isImageAttachment = (value) => {
    if (typeof value !== 'string') return false
    if (/^data:image\//i.test(value)) return true
    const clean = value.split('?')[0].toLowerCase()
    return clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.jpeg') || clean.endsWith('.webp') || clean.endsWith('.gif') || clean.endsWith('.svg')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            {isPreview ? (
              <>
                <Eye className="w-5 h-5 text-primary" /> Confirmar Detalles
              </>
            ) : (
              <>
                {isEditing ? 'Editar Movimiento' : watchedValues.type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isPreview
              ? 'Revisa la información antes de guardar el movimiento.'
              : isEditing
                ? 'Actualiza los campos del movimiento financiero.'
                : 'Completa los campos para registrar un nuevo movimiento financiero.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {!isPreview ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Movimiento</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="income">Ingreso</SelectItem>
                            <SelectItem value="expense">Gasto</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha</FormLabel>
                        <FormControl>
                          <Calendar
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Selecciona una fecha"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monto</FormLabel>
                        <FormControl>
                          <Input placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="CUP">CUP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[200px]">
                            {categoryOptions.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método de Pago</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona método" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentMethodOptions.map((method) => (
                              <SelectItem key={method} value={method}>{method}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Pago de factura de luz..." {...field} />
                      </FormControl>
                      <FormDescription>
                        Breve detalle del movimiento.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas Adicionales</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Cualquier detalle extra..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Adjuntar Comprobantes (Opcional)</FormLabel>
                  <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer relative">
                    <Input
                      type="file"
                      multiple
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                    />
                    <Upload className="h-8 w-8 mb-2" />
                    <p className="text-sm">Click o arrastra archivos aquí</p>
                    {files.length > 0 && (
                      <div className="mt-2 text-xs text-primary font-medium">
                        {files.length} archivo(s) seleccionado(s)
                      </div>
                    )}
                  </div>
                  {isEditing && existingAttachments.length > 0 && (
                    <div className="mt-2 rounded-md border bg-muted/30 p-3">
                      <div className="text-sm font-medium mb-2">Adjuntos actuales</div>
                      <div className="space-y-2">
                        {existingAttachments.map((att) => (
                          <div key={att} className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex items-center gap-2">
                              {isViewableUrl(att) && isImageAttachment(att) && (
                                <img
                                  src={att}
                                  alt=""
                                  className="h-9 w-9 rounded object-cover border bg-background"
                                />
                              )}
                              {isViewableUrl(att) ? (
                                <a
                                  href={att}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-primary underline truncate"
                                  title={att}
                                >
                                  {att}
                                </a>
                              ) : (
                                <div className="text-xs text-muted-foreground truncate" title={att}>
                                  {att}
                                </div>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => removeExistingAttachment(att)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Totals */}
                <div className="bg-muted/50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-medium">Total Estimado:</span>
                  <span className="text-xl font-bold">
                    {calculateTotal().toFixed(2)} {watchedValues.currency}
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-md space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="font-medium">Tipo:</span>
                    <span className="capitalize">{watchedValues.type === 'income' ? 'Ingreso' : 'Gasto'}</span>

                    <span className="font-medium">Fecha:</span>
                    <span>{watchedValues.date ? format(watchedValues.date, 'PPP', { locale: es }) : 'Sin fecha'}</span>

                    <span className="font-medium">Categoría:</span>
                    <span>{watchedValues.category}</span>

                    <span className="font-medium">Monto:</span>
                    <span>{Number(watchedValues.amount).toFixed(2)} {watchedValues.currency}</span>

                    <span className="font-medium text-lg text-primary">Total:</span>
                    <span className="font-bold text-lg text-primary">{calculateTotal().toFixed(2)} {watchedValues.currency}</span>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <span className="font-medium block mb-1">Descripción:</span>
                    <p className="text-muted-foreground">{watchedValues.description}</p>
                  </div>

                  {files.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <span className="font-medium block mb-1">Adjuntos:</span>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {files.map((f, i) => <li key={i}>{f.name}</li>)}
                      </ul>
                    </div>
                  )}

                  {existingAttachments.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <span className="font-medium block mb-1">Adjuntos actuales:</span>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {existingAttachments.map((a) => (
                          <li key={a} className="break-all">
                            {isViewableUrl(a) ? (
                              <a href={a} target="_blank" rel="noreferrer" className="text-primary underline">
                                {a}
                              </a>
                            ) : (
                              a
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              {isPreview && (
                <Button type="button" variant="outline" onClick={() => setIsPreview(false)}>
                  Volver a editar
                </Button>
              )}
              <Button type="submit" className={cn("w-full sm:w-auto", isPreview && "bg-green-600 hover:bg-green-700")}>
                {isPreview ? (
                  <>
                    <Check className="w-4 h-4 mr-2" /> {isEditing ? 'Confirmar y Actualizar' : 'Confirmar y Guardar'}
                  </>
                ) : (
                  "Revisar Datos"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
