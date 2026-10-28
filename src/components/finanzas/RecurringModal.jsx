/* eslint-disable react/prop-types */
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'

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
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import { FREQUENCY_LABELS } from '@/services/recurringTransactions'

const AMOUNT_RE = /^\d{1,12}(\.\d{1,2})?$/

const formSchema = z.object({
  type: z.enum(['income', 'expense']),
  description: z.string().min(3, 'Escribe al menos 3 letras'),
  amount: z.string().trim().refine((v) => AMOUNT_RE.test(v) && Number(v) > 0, {
    message: 'Monto inválido (ej: 150.00)',
  }),
  currency: z.string().min(1, 'Elige una moneda'),
  category: z.string().min(1, 'Elige una categoría'),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']),
  next_run: z.date({ required_error: 'Indica desde cuándo' }),
  payment_method: z.string().optional(),
  contact_id: z.string().optional(),
  status: z.enum(['paid', 'pending']),
  end_date: z.date().nullable().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})

/** Parsea YYYY-MM-DD (o Date) en fecha local sin corrimiento UTC. */
const parseLocalDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const s = String(value).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const toIsoDate = (value) => {
  const d = parseLocalDate(value)
  if (!d) return null
  return format(d, 'yyyy-MM-dd')
}

export function RecurringModal({
  open,
  onOpenChange,
  onSubmit,
  item = null,
  categories,
  paymentMethods = [],
  currencies = [],
  contacts = [],
  submitting = false,
}) {
  const defaultCurrency =
    currencies.find((c) => c.is_default)?.code || currencies[0]?.code || 'USD'

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'expense',
      description: '',
      amount: '',
      currency: defaultCurrency,
      category: '',
      frequency: 'monthly',
      next_run: new Date(),
      payment_method: '',
      contact_id: '',
      status: 'paid',
      end_date: null,
      notes: '',
      is_active: true,
    },
  })

  const type = form.watch('type')
  const categoryOptions = useMemo(() => {
    const list = categories?.[type] || []
    return Array.isArray(list) ? list : []
  }, [categories, type])

  useEffect(() => {
    if (!open) return
    if (item?.id) {
      form.reset({
        type: item.type || 'expense',
        description: item.description || '',
        amount: item.amount != null ? String(item.amount) : '',
        currency: item.currency || defaultCurrency,
        category: item.category || '',
        frequency: item.frequency || 'monthly',
        next_run: parseLocalDate(item.next_run) || new Date(),
        payment_method: item.payment_method || '',
        contact_id: item.contact_id != null ? String(item.contact_id) : '',
        status: item.status === 'pending' ? 'pending' : 'paid',
        end_date: parseLocalDate(item.end_date),
        notes: item.notes || '',
        is_active: item.is_active !== false,
      })
    } else {
      form.reset({
        type: 'expense',
        description: '',
        amount: '',
        currency: defaultCurrency,
        category: '',
        frequency: 'monthly',
        next_run: new Date(),
        payment_method: '',
        contact_id: '',
        status: 'paid',
        end_date: null,
        notes: '',
        is_active: true,
      })
    }
  }, [open, item, defaultCurrency, form])

  const handleSubmit = (values) => {
    onSubmit({
      id: item?.id,
      type: values.type,
      description: values.description.trim(),
      amount: values.amount,
      currency: values.currency,
      category: values.category,
      frequency: values.frequency,
      next_run: toIsoDate(values.next_run),
      payment_method: values.payment_method || null,
      contact_id: values.contact_id ? Number(values.contact_id) : null,
      status: values.status,
      end_date: toIsoDate(values.end_date),
      notes: values.notes?.trim() || null,
      is_active: values.is_active,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{item?.id ? 'Editar repetición' : 'Algo que se repite'}</DialogTitle>
          <DialogDescription>
            Ejemplos: alquiler, nómina, internet. Gestia lo anotará solo cuando llegue la fecha.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Es un ingreso o un gasto?</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v)
                      form.setValue('category', '')
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="expense">Gasto (sale dinero)</SelectItem>
                      <SelectItem value="income">Ingreso (entra dinero)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Cómo lo llamas?</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Alquiler del local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="100.00" {...field} />
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
                        {currencies.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.name || c.code} ({c.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Elige…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoryOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>¿Cada cuánto?</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="next_run"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Próxima fecha</FormLabel>
                    <FormControl>
                      <Calendar
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Selecciona una fecha"
                        className="h-11"
                        options={{ maxDate: null }}
                      />
                    </FormControl>
                    <FormDescription>Cuándo se anota la próxima vez.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Hasta (opcional)</FormLabel>
                    <FormControl>
                      <Calendar
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Sin fecha de fin"
                        className="h-11"
                        options={{ maxDate: null }}
                      />
                    </FormControl>
                    <FormDescription>Déjalo vacío si no termina.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Al anotarlo, ¿queda pagado?</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="paid">Sí, ya pagado / cobrado</SelectItem>
                      <SelectItem value="pending">No, queda pendiente</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {paymentMethods?.length > 0 && (
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de pago (opcional)</FormLabel>
                    <Select value={field.value || '__none'} onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">Sin especificar</SelectItem>
                        {paymentMethods.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {contacts?.length > 0 && (
              <FormField
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contacto (opcional)</FormLabel>
                    <Select value={field.value || '__none'} onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none">Sin contacto</SelectItem>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Algo que quieras recordar…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5 pr-3">
                    <FormLabel className="text-base">Activa</FormLabel>
                    <FormDescription>Si la pausas, Gestia no la anota sola.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando…' : item?.id ? 'Guardar cambios' : 'Crear repetición'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
