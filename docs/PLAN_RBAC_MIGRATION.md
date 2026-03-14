# Plan de Migración a Sistema de Roles y Permisos Granulares (RBAC)

## 1. Análisis de la Situación Actual

Actualmente, el sistema maneja la autorización a través de dos mecanismos principales que operan en paralelo pero de forma desconectada:

1.  **Tabla `profiles`**: Define si un usuario es `admin` o `employee`. Este rol parece estar más orientado a la jerarquía del sistema global o tipos de cuenta heredados.
2.  **Tabla `team_members`**: Gestiona la relación entre un dueño de cuenta (Owner) y sus colaboradores. Utiliza un campo de texto simple `role` con valores como `admin`, `editor`, `viewer`.
3.  **Lógica en Frontend**:
    *   `SubscriptionContext`: Controla límites de planes (Free vs Premium).
    *   `useUserRole`: Lee de `profiles`.
    *   No existe una validación centralizada de permisos por funcionalidad (ej. "puede ver finanzas" vs "puede editar finanzas").

**Limitaciones actuales:**
*   Los roles son estáticos y hardcodeados.
*   No se puede personalizar qué hace cada rol.
*   La validación de "email único" (no ser dueño y empleado a la vez) no se aplica estrictamente a nivel de base de datos.

## 2. Nueva Arquitectura de Datos (Fase 1)

Se implementará un modelo RBAC (Role-Based Access Control) completo.

### 2.1. Nuevas Tablas

#### `permissions` (Catálogo Global del Sistema)
Define todas las acciones posibles en el sistema. Es estática y definida por los desarrolladores.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `code` | text | Código único (ej. `finanzas.view`, `inventory.create`) |
| `module` | text | Módulo (Finanzas, Inventario, Configuración...) |
| `description` | text | Descripción legible |

#### `roles` (Roles por Negocio)
Define los roles disponibles. Pueden ser roles de sistema (globales) o personalizados por cada negocio.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `owner_id` | uuid | FK a `auth.users`. NULL para roles de sistema, ID del dueño para roles personalizados. |
| `name` | text | Nombre del rol (ej. "Contador", "Almacenero") |
| `description` | text | Descripción opcional |
| `is_system` | bool | Si es true, no se puede editar/borrar |

#### `role_permissions` (Tabla Intermedia)
Asigna permisos a los roles.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `role_id` | uuid | FK a `roles` |
| `permission_id` | uuid | FK a `permissions` |

### 2.2. Modificación de `team_members`

Se reemplazará el campo de texto `role` por una referencia a la nueva tabla `roles`.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `role_id` | uuid | FK a `roles`. Reemplaza al campo `role` actual. |

## 3. Catálogo de Permisos Propuesto

| Módulo | Código | Descripción |
| :--- | :--- | :--- |
| **Dashboard** | `dashboard.view` | Ver panel principal |
| **Finanzas** | `finanzas.view` | Ver listados y reportes financieros |
| | `finanzas.create` | Crear transacciones |
| | `finanzas.edit` | Editar transacciones existentes |
| | `finanzas.delete` | Eliminar transacciones |
| | `finanzas.export` | Exportar data financiera |
| **Inventario** | `inventory.view` | Ver productos y stock |
| | `inventory.create` | Crear productos |
| | `inventory.edit` | Editar productos |
| | `inventory.delete` | Eliminar productos |
| | `inventory.move` | Registrar entradas/salidas |
| **Configuración** | `config.view` | Ver configuración |
| | `config.edit` | Editar configuración del negocio (monedas, balances) |
| | `team.manage` | Invitar/Eliminar socios y gestionar roles |
| **Logs** | `logs.view` | Ver logs de auditoría |

## 4. Roles Predefinidos (Sistema)

Se crearán automáticamente estos roles en la tabla `roles` con `is_system = true`:

1.  **Super Admin (Dueño)**: Acceso implícito total (no necesita validación de permisos, o tiene todos asignados).
2.  **Administrador Limitado**:
    *   Todos los permisos de Finanzas e Inventario.
    *   `dashboard.view`, `config.view`.
    *   SIN `config.edit`, `team.manage`, `logs.view`.
3.  **Visualizador**:
    *   Solo permisos `.view` de todos los módulos.

## 5. Estrategia de Migración de Datos

Para no romper el servicio actual, la migración se hará en pasos:

1.  **Crear tablas nuevas** (`permissions`, `roles`, `role_permissions`).
2.  **Popular datos semilla**: Insertar los permisos base y los roles de sistema definidos arriba.
3.  **Migrar usuarios actuales**:
    *   Iterar sobre `team_members`.
    *   Si `role` == 'admin' -> Asignar `role_id` del "Administrador Limitado".
    *   Si `role` == 'editor' -> Asignar `role_id` de un nuevo rol "Editor" (Finanzas+Inventario completo).
    *   Si `role` == 'viewer' -> Asignar `role_id` del "Visualizador".
4.  **Switch de columna**: Renombrar `role` a `role_legacy` (backup) y hacer `role_id` obligatorio.

## 6. Validaciones de Seguridad (Email Único)

Se implementará una función PostgreSQL `check_email_availability(email)` que se ejecutará antes de invitar a un socio.

**Lógica de Validación:**
1.  Verificar si el email ya existe en `auth.users`.
2.  Si existe:
    *   Verificar si ese usuario es "Dueño" (tiene entradas en `business_balances` o `products` como owner).
    *   Verificar si ese usuario ya está en `team_members` (como miembro de otro equipo).
3.  Si cualquiera es verdadero -> **Bloquear registro**.

## 7. Plan de Implementación por Fases

### Fase 1: Base de Datos (Inmediato)
*   Crear migraciones SQL para la nueva estructura.
*   Crear funciones RPC para validación de emails.
*   Crear políticas RLS para las nuevas tablas (solo el owner puede ver/editar sus roles personalizados).

### Fase 2: Backend & Servicios (Día 1-2)
*   Actualizar servicios en `src/services/team.js` (o similar) para usar las nuevas tablas.
*   Crear endpoints para CRUD de roles (para la configuración personalizada).

### Fase 3: Frontend - Lógica (Día 2-3)
*   Crear `RBACContext`: Al iniciar sesión, cargar los permisos del usuario (si es owner, tiene `['*']`).
*   Crear componente `<PermissionGuard>` para envolver botones y rutas.
*   Actualizar `ProtectedRoute` para validar permisos en lugar de roles fijos.

### Fase 4: Frontend - UI (Día 3-4)
*   Actualizar página de "Equipo" en Configuración.
*   Añadir interfaz para crear/editar Roles Personalizados (selección de checkboxes de permisos).

### Fase 5: Migración y Despliegue (Día 5)
*   Ejecutar script de migración de datos.
*   Verificar integridad.

## 8. Criterios de Éxito
*   [ ] Un usuario "Visualizador" no ve botones de "Guardar" ni "Eliminar".
*   [ ] Un intento de invitar a un email que ya es dueño de negocio falla con mensaje claro.
*   [ ] Los usuarios existentes mantienen su nivel de acceso esperado tras la migración.
