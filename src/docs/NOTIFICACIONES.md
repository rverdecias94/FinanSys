# Sistema de Notificaciones y Retroalimentación

Este proyecto incluye un sistema de notificaciones centralizado basado en `sonner` y `@tanstack/react-query`, diseñado para proporcionar retroalimentación automática y consistente en todas las operaciones de la aplicación.

## Características Principales

1. **Notificaciones Automáticas**: Integración con React Query para mostrar mensajes de éxito/error en operaciones CRUD sin código repetitivo.
2. **Manejo de Errores de Supabase**: Traducción automática de códigos de error técnicos (PostgreSQL) a mensajes amigables para el usuario.
3. **Estilos Unificados**: Componentes visuales consistentes con el diseño del sistema (iconos, colores).
4. **Cola de Mensajes**: Manejo de múltiples notificaciones simultáneas.

## Guía de Uso

### 1. Operaciones CRUD Automáticas (Recomendado)

Al usar `useMutation` de React Query, puedes configurar la propiedad `meta` para definir mensajes automáticos. El sistema interceptará el resultado y mostrará la notificación correspondiente.

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createItem } from '@/services/miServicio'

// En tu componente:
const createMutation = useMutation({
  mutationFn: createItem,
  meta: {
    successMessage: "Producto creado exitosamente", // Mensaje de éxito
    errorMessage: "No se pudo crear el producto"    // Mensaje de error personalizado (opcional)
  },
  onSuccess: () => {
    // Tu lógica adicional (ej. invalidar queries)
  }
})

// Uso:
createMutation.mutate(data)
```

**Comportamiento:**
- **Éxito**: Muestra el `successMessage`. Si no se define, muestra "Operación realizada correctamente" si `showGenericSuccess: true`.
- **Error**: Si hay un `errorMessage`, lo muestra. Si no, intenta traducir el error de Supabase (ej. "Registro duplicado").

### 2. Notificaciones Manuales

Para casos donde no uses `useMutation` o necesites notificaciones específicas, importa el servicio `notify`.

```javascript
import { notify } from '@/services/notifications'

// Éxito
notify.success("Datos guardados correctamente")

// Error
notify.error("Ocurrió un error inesperado")

// Advertencia
notify.warning("Faltan campos obligatorios")

// Información
notify.info("El proceso ha comenzado")

// Promesas (Loading -> Éxito/Error)
notify.promise(miFuncionAsync(), {
  loading: 'Guardando...',
  success: 'Guardado exitosamente',
  error: 'Error al guardar'
})
```

### 3. Manejo de Errores de Supabase

El sistema detecta automáticamente códigos de error comunes de PostgreSQL/Supabase:

| Código | Significado | Mensaje al Usuario |
|--------|-------------|--------------------|
| 23505  | Unique Violation | "Este registro ya existe (valor duplicado)." |
| 23503  | FK Violation | "No se puede realizar esta acción porque el registro está relacionado con otros datos." |
| 42501  | Permisos | "No tienes permisos para realizar esta acción." |

En modo desarrollo (`import.meta.env.DEV`), se muestran detalles técnicos adicionales para facilitar la depuración.

## Configuración del Sistema

El sistema se inicializa en dos partes:

1. **`src/main.jsx`**: Configuración global de `QueryClient` con `MutationCache` y `QueryCache`.
2. **`src/App.jsx`**: Renderizado del componente `<Toaster />`.
3. **`src/services/notifications.jsx`**: Lógica central de notificaciones y parseo de errores.
