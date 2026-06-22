import * as z from 'zod'

/**
 * Valida `data` contra un esquema zod y devuelve los errores mapeados por campo
 * (primer error por campo), para mostrarlos inline en los formularios.
 *
 * @returns {{ success: boolean, data?: any, errors: Record<string,string> }}
 */
export function validateForm(schema, data) {
  const result = schema.safeParse(data)
  if (result.success) return { success: true, data: result.data, errors: {} }
  const errors = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0]
    if (key != null && errors[key] === undefined) errors[key] = issue.message
  }
  return { success: false, errors }
}

// Reglas reutilizables
const requiredName = z.string().trim()
  .min(1, 'El nombre es obligatorio')
  .max(120, 'Máximo 120 caracteres')

// Monto monetario: hasta 12 enteros y 2 decimales, sin letras/símbolos (≥ 0).
const moneyString = z.string().trim()
  .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), 'Ingresa un valor válido (ej: 1500.50)')
  .refine((v) => Number(v) >= 0, 'No puede ser negativo')

// Entero ≥ 0 (cantidades de stock).
const nonNegativeInt = z.string().trim()
  .refine((v) => /^\d{1,9}$/.test(v), 'Debe ser un número entero ≥ 0')

// --- Producto (almacén) ---
export const productSchema = z.object({
  name: requiredName,
  category: z.string().trim().max(60, 'Máximo 60 caracteres').optional(),
  unit_price: moneyString,
  currency: z.string().min(1, 'Selecciona una moneda'),
  stock: nonNegativeInt,
  min_stock: nonNegativeInt,
})

// --- Movimiento de almacén ---
export const movementSchema = z.object({
  product_id: z.string().min(1, 'Selecciona un producto'),
  type: z.enum(['in', 'out']),
  qty: z.string().trim()
    .refine((v) => /^\d{1,9}$/.test(v) && Number(v) >= 1, 'La cantidad debe ser un entero mayor que cero'),
})

// Correo electrónico (regla reutilizable)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// --- Contacto (cliente/proveedor) ---
export const contactSchema = z.object({
  name: requiredName,
  kind: z.enum(['cliente', 'proveedor', 'ambos']),
  phone: z.string().trim().max(30, 'Máximo 30 caracteres')
    .refine((v) => v === '' || /^[0-9+()\-\s]{6,30}$/.test(v), 'Teléfono inválido (solo dígitos, espacios y + ( ) -)')
    .optional(),
  email: z.string().trim()
    .refine((v) => v === '' || emailRegex.test(v), 'Correo electrónico inválido')
    .optional(),
  notes: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
})

// --- Área (inventario dinámico) ---
export const areaSchema = z.object({
  name: requiredName,
  icon: z.string().trim().min(1, 'Selecciona un icono'),
  slug: z.string().trim().max(60, 'Máximo 60 caracteres')
    .refine((v) => v === '' || /^[a-z0-9-]+$/.test(v), 'Solo minúsculas, números y guiones (ej: cocina-principal)')
    .optional(),
  prefix: z.string().trim()
    .refine((v) => v === '' || /^[A-Za-z0-9]{3,4}$/.test(v), 'El prefijo debe tener 3-4 letras o números (ej: ADM)')
    .optional(),
})

// --- Rol personalizado (config) ---
export const roleSchema = z.object({
  name: requiredName,
  description: z.string().trim().max(200, 'Máximo 200 caracteres').optional(),
})

// --- Correo electrónico (login / recuperación de contraseña) ---
export const emailSchema = z.object({
  email: z.string().trim()
    .min(1, 'El correo es obligatorio')
    .refine((v) => emailRegex.test(v), 'Correo electrónico inválido'),
})
