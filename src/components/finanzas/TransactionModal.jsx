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
  amount: z.string()
    .trim()
    // P1.13: validación de monto endurecida. El `!isNaN(Number(val))` anterior aceptaba
    // Infinity, hexadecimal (0x10), notación científica (1e3) y espacios. El regex solo
    // admite dígitos con hasta 2 decimales (formato monetario), hasta 12 enteros.
    .refine((val) => /^\d{1,12}(\.\d{1,2})?$/.test(val), {
      message: "Ingresa un monto válido (ej: 1500.50), sin letras ni símbolos.",
    })
    .refine((val) => {
      const n = Number(val)
      return Number.isFinite(n) && n > 0
    }, {
      message: "El monto debe ser mayor que cero.",
    }),
  currency: z.string().min(1, "La moneda es obligatoria"),
  category: z.string().min(1, "La categoría es obligatoria"),
  description: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
  notes: z.string().optional(),
  // CxC/CxP (Fase 1): contacto + estado de cobro/pago + vencimiento (opcionales).
  contact_id: z.string().optional(),
  status: z.enum(['paid', 'pending']).optional(),
  due_date: z.date().nullable().optional(),
  files: z.any().optional(), // For mock attachment
})

export function TransactionModal({ open, onOpenChange, onSubmit, categories, paymentMethods, transaction, currencies = [], contacts = [], submitting = false, readonly = false }) {
  const [isPreview, setIsPreview] = useState(false)
  const [files, setFiles] = useState([])
  const [existingAttachments, setExistingAttachments] = useState([])
  const [deletedAttachments, setDeletedAttachments] = useState([])

  const defaultCurrency = currencies.find(c => c.is_default)?.code || (currencies.length > 0 ? currencies[0].code : 'USD')

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      date: new Date(),
      amount: '',
      currency: defaultCurrency,
      category: '',
      description: '',
      payment_method: '',
      bank_account_id: '',
      notes: '',
      contact_id: '',
      status: 'paid',
      due_date: null,
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
          currency: transaction?.currency || defaultCurrency,
          category: transaction?.category || '',
          description: transaction?.description || '',
          payment_method: details.payment_method || '',
          bank_account_id: details.bank_account_id ? String(details.bank_account_id) : '',
          notes: details.notes || '',
          contact_id: transaction?.contact_id != null ? String(transaction.contact_id) : '',
          status: transaction?.status === 'paid' ? 'paid' : 'pending',
          due_date: transaction?.due_date ? new Date(transaction.due_date) : null,
        })

        const attachments = Array.isArray(details.attachments) ? details.attachments.filter(a => typeof a === 'string' && a.trim() !== '') : []
        setExistingAttachments(attachments)
        setDeletedAttachments([])
      } else {
        form.reset({
          type: 'expense',
          date: new Date(),
          amount: '',
          currency: defaultCurrency,
          category: '',
          description: '',
          payment_method: '',
          bank_account_id: '',
          notes: '',
          contact_id: '',
          status: 'paid',
          due_date: null,
        })
        setExistingAttachments([])
        setDeletedAttachments([])
      }
      setIsPreview(false)
      setFiles([])
    }
  }, [open, form, isEditing, transaction, defaultCurrency])

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
    setDeletedAttachments((prev) => [...prev, attachment])
  }

  const handleSubmit = (data) => {
    if (readonly) return
    if (!isPreview) {
      setIsPreview(true)
      return
    }
    // Final submit
    const mergedAttachments = [...existingAttachments, ...files]
    const payload = {
      ...data,
      id: transaction?.id,
      amount: Number(data.amount),
      contact_id: data.contact_id ? Number(data.contact_id) : null,
      // Conservar abonos previos al editar (el servicio recalcula 'partial'/'paid').
      paid_amount: transaction?.paid_amount,
      attachments: mergedAttachments,
      deleted_attachments: deletedAttachments
    }
    onSubmit(payload)
  }

  const calculateTotal = () => {
    // P1.13: evita mostrar "NaN" en "Total Estimado" mientras el monto es inválido.
    const amount = Number(watchedValues.amount)
    return Number.isFinite(amount) && amount > 0 ? amount : 0
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
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        form.reset()
        setExistingAttachments([])
        setDeletedAttachments([])
        setFiles([])
        setIsPreview(false)
      }
    }}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            {isPreview ? (
              <>
                <Eye className="w-5 h-5 text-primary" /> Confirmar Detalles
              </>
            ) : (
              <>
                {readonly ? 'Ver Movimiento' : isEditing ? 'Editar Movimiento' : watchedValues.type === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {readonly
              ? 'Detalle del movimiento financiero (solo lectura).'
              : isPreview
                ? 'Revisa la información antes de guardar el movimiento.'
                : isEditing
                  ? 'Actualiza los campos del movimiento financiero.'
                  : 'Completa los campos para registrar un nuevo movimiento financiero.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <fieldset disabled={readonly} className="space-y-6 m-0 p-0 border-0 min-w-0 disabled:cursor-not-allowed disabled:opacity-95">
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
                            <SelectTrigger className="h-11">
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
                            className="h-11"
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
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                            ))}
                            {currencies.length === 0 && (
                              <SelectItem value="USD">USD</SelectItem>
                            )}
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
                            <SelectTrigger className="h-11">
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
                            <SelectTrigger className="h-11">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contact_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contacto (opcional)</FormLabel>
                        <Select
                          value={field.value || 'none'}
                          onValueChange={(v) => field.onChange(v === 'none' ? '' : v)}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Sin contacto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[200px]">
                            <SelectItem value="none">Sin contacto</SelectItem>
                            {contacts.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="paid">Pagado</SelectItem>
                            <SelectItem value="pending">{watchedValues.type === 'income' ? 'Por cobrar' : 'Por pagar'}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {watchedValues.status === 'pending' && (
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de vencimiento</FormLabel>
                        <FormControl>
                          <Calendar
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Selecciona el vencimiento"
                            className="h-11"
                            options={{ maxDate: null }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                  {files.length === 0 && existingAttachments.length === 0 ? (
                    <div className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer relative overflow-hidden">
                      <Input
                        type="file"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleFileChange}
                        accept="image/*,.pdf"
                        title=""
                      />
                      <Upload className="h-8 w-8 mb-2" />
                      <p className="text-sm">Click para seleccionar archivos</p>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-md border bg-muted/10 p-4">
                      <div className="flex flex-wrap gap-4">
                        {existingAttachments.map((att, idx) => {
                          if (typeof att !== 'string') return null;
                          const isImg = isImageAttachment(att);
                          return (
                            <div key={`existing-${idx}`} className="relative group rounded-md border bg-background p-2 w-32 flex flex-col items-center shadow-sm">
                              {isImg ? (
                                <img src={att} alt="Preview" className="h-24 w-full object-cover rounded-sm" />
                              ) : (
                                <div className="h-24 w-full flex items-center justify-center bg-muted rounded-sm">
                                  <span className="text-xs font-medium uppercase break-all px-2 text-center text-muted-foreground">Doc</span>
                                </div>
                              )}
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm z-20"
                                onClick={() => removeExistingAttachment(att)}
                                title="Eliminar"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })}

                        {files.map((file, idx) => {
                          const isImg = file.type.startsWith('image/');
                          const previewUrl = isImg ? URL.createObjectURL(file) : null;
                          return (
                            <div key={`file-${idx}`} className="relative group rounded-md border bg-background p-2 w-32 flex flex-col items-center shadow-sm">
                              {isImg ? (
                                <img src={previewUrl} alt="Preview" className="h-24 w-full object-cover rounded-sm" />
                              ) : (
                                <div className="h-24 w-full flex items-center justify-center bg-muted rounded-sm">
                                  <span className="text-xs font-medium uppercase break-all px-2 text-center text-muted-foreground line-clamp-2">{file.name}</span>
                                </div>
                              )}
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm z-20"
                                onClick={() => {
                                  setFiles(prev => prev.filter((_, i) => i !== idx));
                                }}
                                title="Eliminar"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })}
                        
                        <div className="relative flex items-center justify-center w-32 h-[114px] border-2 border-dashed rounded-md hover:bg-accent/50 cursor-pointer overflow-hidden">
                          <Input
                            type="file"
                            multiple
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                              if (e.target.files) {
                                setFiles(prev => [...prev, ...Array.from(e.target.files)]);
                              }
                            }}
                            accept="image/*,.pdf"
                            title=""
                          />
                          <div className="flex flex-col items-center text-muted-foreground">
                            <Upload className="h-5 w-5 mb-1" />
                            <span className="text-[10px] uppercase font-medium">Más</span>
                          </div>
                        </div>
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

                    <span className="font-medium">Estado:</span>
                    <span>{watchedValues.status === 'paid' ? 'Pagado' : (watchedValues.type === 'income' ? 'Por cobrar' : 'Por pagar')}</span>

                    {watchedValues.contact_id && (
                      <>
                        <span className="font-medium">Contacto:</span>
                        <span>{contacts.find(c => String(c.id) === String(watchedValues.contact_id))?.name || '-'}</span>
                      </>
                    )}

                    {watchedValues.status === 'pending' && watchedValues.due_date && (
                      <>
                        <span className="font-medium">Vence:</span>
                        <span>{format(watchedValues.due_date, 'PPP', { locale: es })}</span>
                      </>
                    )}

                    <span className="font-medium text-lg text-primary">Total:</span>
                    <span className="font-bold text-lg text-primary">{calculateTotal().toFixed(2)} {watchedValues.currency}</span>
                  </div>

                  <div className="border-t pt-2 mt-2">
                    <span className="font-medium block mb-1">Descripción:</span>
                    <p className="text-muted-foreground">{watchedValues.description}</p>
                  </div>

                  {files.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <span className="font-medium block mb-2">Adjuntos nuevos:</span>
                      <div className="flex gap-2 flex-wrap">
                        {files.map((f, i) => {
                          const isImg = f.type.startsWith('image/');
                          return isImg ? (
                            <img key={i} src={URL.createObjectURL(f)} alt="preview" className="h-16 w-16 object-cover rounded border bg-background" />
                          ) : (
                            <div key={i} className="h-16 px-3 flex items-center justify-center bg-muted rounded border text-xs text-muted-foreground max-w-[120px] truncate">{f.name}</div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {existingAttachments.length > 0 && (
                    <div className="border-t pt-2 mt-2">
                      <span className="font-medium block mb-2">Adjuntos actuales:</span>
                      <div className="flex gap-2 flex-wrap">
                        {existingAttachments.map((a, idx) => {
                          if (typeof a !== 'string') return null;
                          const isImg = isImageAttachment(a);
                          return isImg ? (
                            <img key={idx} src={a} alt="preview" className="h-16 w-16 object-cover rounded border bg-background" />
                          ) : (
                            <div key={idx} className="h-16 px-3 flex items-center justify-center bg-muted rounded border text-xs text-muted-foreground">Doc</div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            </fieldset>

            <DialogFooter className="gap-2 sm:gap-0">
              {readonly ? (
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              ) : (
                <>
                  {isPreview && (
                    <Button type="button" variant="outline" onClick={() => setIsPreview(false)}>
                      Volver a editar
                    </Button>
                  )}
                  <Button type="submit" loading={isPreview && submitting} className="w-full sm:w-auto">
                    {isPreview ? (
                      <>
                        <Check className="w-4 h-4 mr-2" /> {isEditing ? 'Confirmar y Actualizar' : 'Confirmar y Guardar'}
                      </>
                    ) : (
                      "Revisar Datos"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
