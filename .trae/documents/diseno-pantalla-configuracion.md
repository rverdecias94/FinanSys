# Diseño de Pantalla: Configuración

## Layout
- Enfoque **desktop-first** con contenedor centrado.
- Estructura híbrida:
  - Header superior (Flexbox)
  - Pestañas horizontales (Flexbox)
  - Contenido de pestaña en tarjetas (CSS Grid 12 columnas o grid simple con 2–3 columnas según sección)
- Espaciado base: 8px (escala 8/16/24/32).
- Breakpoints:
  - Desktop ≥ 1200px: contenido en 2 columnas cuando aplique.
  - Tablet 768–1199px: 1 columna, pestañas con scroll horizontal si no caben.
  - Mobile ≤ 767px: 1 columna, pestañas como “segmented control” desplazable.

## Meta Information
- Title: "Configuración"
- Description: "Administra plan, ajustes generales, monedas, equipo y control de acceso."
- Open Graph:
  - og:title: "Configuración"
  - og:description: "Planes, General, Monedas, Equipo, Roles y Permisos."

## Global Styles (tokens)
- Fondo app: #0B1220 (oscuro) o #F7F8FA (claro). (Definir uno; recomendable claro por legibilidad de formularios.)
- Superficie (cards): #FFFFFF
- Borde: #E5E7EB
- Texto principal: #111827; secundario: #6B7280
- Color primario: #2563EB
- Éxito (badge plan actual): #16A34A
- Peligro (eliminar): #DC2626
- Tipografía:
  - H1 24/32 semibold
  - H2 18/28 semibold
  - Body 14/20 regular
- Botones:
  - Primary: fondo #2563EB, texto blanco, hover #1D4ED8
  - Secondary: borde #D1D5DB, hover fondo #F3F4F6
  - Destructive: fondo #DC2626, hover #B91C1C
- Links: #2563EB con subrayado en hover.

## Page Structure
1) Header de página
2) Barra de pestañas
3) Panel de contenido (cambia según pestaña)
4) Barra inferior de acciones (solo cuando hay cambios sin guardar, en General/Permisos/Roles)

---

## Componentes comunes (todas las pestañas)
### 1) Header
- Título: "Configuración"
- Subtítulo contextual: "Gestiona parámetros y accesos del sistema"
- Indicador compacto del plan actual (chip): "Plan: Gratis" o "Plan: Premium".

### 2) Tabs (Pestañas)
- Pestañas: **Planes / General / Monedas / Equipo / Roles / Permisos**.
- Estado activo: subrayado o píldora con color primario.
- Persistencia: recuerda última pestaña visitada en la sesión.

### 3) Estados
- Loading: skeleton en cards y tablas.
- Empty states:
  - Equipo sin miembros (solo propietario): mostrar CTA “Invitar miembro”.
  - Roles sin roles personalizados: mostrar CTA “Crear rol”.
- Error: banner no intrusivo con mensaje + acción “Reintentar”.

---

## Pestaña: Planes
### Objetivo
Comparar **Gratis** vs **Premium**, ver **límites** y marcar el **plan actual**.

### Estructura
- Grid de 2 tarjetas (desktop):
  - Card “Gratis”
  - Card “Premium”

### Elementos por tarjeta
- Nombre del plan
- Badge:
  - Si es el actual: badge verde “Plan actual” (alto contraste)
- Lista de límites (mínimos requeridos):
  - “Miembros del equipo: N”
  - “Monedas activas: N”
  - “Roles personalizados: N”
- Botón CTA:
  - Si NO es actual: “Elegir plan” / “Actualizar a Premium”
  - Si ES actual: botón deshabilitado “Plan actual”

### Reglas de interacción
- Al elegir plan:
  - Modal de confirmación con resumen de cambios y advertencia de límites si se baja de plan.

---

## Pestaña: General
### Objetivo
Editar parámetros generales.

### Estructura
- Card “Datos generales” con formulario en 2 columnas (desktop):
  - Campo texto / select / toggles según configuración.

### Elementos
- Campos editables (genéricos y configurables):
  - Nombre de la empresa/organización
  - Identificadores fiscales (si aplica)
  - Dirección/Contacto (si aplica)
- Acciones:
  - “Guardar cambios” (primary)
  - “Cancelar” (secondary) si hay cambios sin guardar

### Validaciones
- Requeridos: nombre
- Mensajes inline bajo el campo.

---

## Pestaña: Monedas
### Objetivo
Activar/desactivar monedas y respetar límites del plan.

### Estructura
- Tabla o lista con búsqueda:
  - Columnas: Código (ISO), Nombre, Estado (toggle), Acciones

### Elementos
- Buscador
- Toggle “Activa”
- Contador superior: “Monedas activas: X / Límite: Y”

### Reglas
- Si alcanza el límite del plan, deshabilitar activación adicional y mostrar tooltip: “Límite del plan alcanzado”.

---

## Pestaña: Equipo
### Objetivo
Gestionar miembros e invitar, asignar roles y respetar límites.

### Estructura
- Header de sección:
  - Contador: “Miembros: X / Límite: Y”
  - Botón “Invitar miembro”
- Tabla:
  - Nombre/Email
  - Estado (pendiente/activo)
  - Rol (select)
  - Acciones: “Quitar”

### Reglas
- Invitar miembro:
  - Modal con email + rol inicial.
- Límite de miembros:
  - Si se supera/alcanzó, bloquear nuevas invitaciones.

---

## Pestaña: Roles
### Objetivo
Crear, editar y eliminar **roles personalizados** (sin rol “Visualizador”).

### Estructura
- Lista de roles (panel izquierdo) + detalle del rol (panel derecho) en desktop.
- En tablet/mobile: lista y detalle en navegación apilada.

### Elementos
- Botón “Crear rol”
- Lista de roles:
  - Nombre
  - Chip “Sistema” si `is_system=true` (no editable/eliminable)
- Detalle del rol:
  - Nombre (editable)
  - Descripción (opcional)
  - Botón “Eliminar rol” (solo si es personalizado)
  - Enlace/CTA a “Configurar permisos” (lleva a pestaña Permisos con rol preseleccionado)

### Reglas críticas
- Eliminar rol:
  - Si está asignado a miembros, requerir reasignación (modal: seleccionar nuevo rol).
- No mostrar ni crear rol predefinido “Visualizador”.

---

## Pestaña: Permisos
### Objetivo
Asignar permisos a un rol.

### Estructura
- Selector de rol (dropdown) en la parte superior.
- Lista de permisos agrupados por categoría (acordeón o cards):
  - Configuración (ver)
  - Planes
  - General
  - Monedas
  - Equipo
  - Roles
  - Permisos

### Elementos
- Selector “Rol”
- Lista de checkboxes por permiso
- Acciones:
  - “Guardar cambios”
  - “Restablecer” (opcional) si hay cambios sin guardar

### Reglas
- Guardado con confirmación no intrusiva (toast): “Permisos actualizados”.
- Aplicación inmediata al acceso efectivo de miembros con ese rol.
