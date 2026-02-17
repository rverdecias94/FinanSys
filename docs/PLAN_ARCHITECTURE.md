# Arquitectura de Planes y Suscripciones (Freemium)

## Visión General
El sistema implementa una estrategia Freemium con dos niveles: **Gratuito** y **Premium**. La arquitectura se basa en un modelo híbrido donde las restricciones de UI se manejan en el frontend (React Context) y la seguridad de datos se refuerza mediante RLS (Row Level Security) en PostgreSQL (Supabase).

## Planes

| Característica | Plan Gratuito | Plan Premium |
|---|---|---|
| **Transacciones Mensuales** | 50 por módulo | Ilimitadas |
| **Productos** | 50 total | Ilimitados |
| **Reportes** | Solo lectura (Pantalla) | Exportación (PDF/Excel), Filtros Avanzados |
| **Socios/Equipo** | 0 (Solo Admin) | Hasta 5 socios |
| **Logs de Auditoría** | Bloqueado | Acceso completo |
| **Branding** | Marca de agua | Personalizable (Sin marca de agua) |

## Componentes Técnicos

### 1. Base de Datos (PostgreSQL / Supabase)
Se han añadido las siguientes tablas:
*   `plans`: Definición de planes y límites (JSONB).
*   `subscriptions`: Estado de la suscripción del usuario (`active`, `trial`, etc.).
*   `usage_metrics`: Contador de uso mensual por usuario y métrica.
*   `team_members`: Relación de socios invitados por el usuario "Owner".

### 2. Contexto de Suscripción (`SubscriptionContext`)
Ubicado en `src/context/SubscriptionContext.jsx`, este provider global:
*   Carga el plan actual del usuario al iniciar sesión.
*   Calcula el uso actual frente a los límites.
*   Expone funciones: `checkLimit(metric)`, `recordUsage(metric)`, `canAccessFeature(feature)`.
*   Maneja la lógica de "Prueba Gratuita" (Trial) de 3 días.

### 3. Seguridad (RLS Policies)
Las políticas de seguridad a nivel de fila aseguran que:
*   Los usuarios Free no puedan insertar registros si exceden su cuota (vía Triggers o lógica de servicio - *Nota: Implementación actual confía en validación de servicio, se recomienda añadir Triggers de DB para seguridad robusta*).
*   Los "Socios" (Team Members) puedan acceder a los datos del "Owner" si han sido invitados y aceptados.

### 4. Flujo de Conversión
*   **Bloqueo Progresivo**: Al intentar una acción restringida (ej. exportar reporte), se verifica el permiso.
*   **Upsell**: Si el permiso es denegado, se muestra un mensaje (Toast o Alerta) invitando a actualizar.
*   **Trial Automático**: Si el usuario acepta, se activa una prueba de 3 días modificando el estado en `subscriptions`.

## Guía de Uso para Desarrolladores

### Verificar Permisos en Componentes
```javascript
const { canAccessFeature } = useSubscription()

if (!canAccessFeature('reports_export')) {
  return <LockedFeatureComponent />
}
```

### Verificar Límites antes de Escribir
```javascript
const { checkLimit, recordUsage } = useSubscription()

const handleCreate = () => {
  if (checkLimit('monthly_transactions')) {
    // Realizar operación
    await createItem(...)
    // Registrar uso
    recordUsage('monthly_transactions')
  }
}
```

## Migración
Para aplicar los cambios en la base de datos, ejecutar el script SQL ubicado en:
`supabase/migrations/20260213_plans_and_teams.sql`
