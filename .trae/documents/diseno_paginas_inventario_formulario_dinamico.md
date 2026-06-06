# Diseño de Páginas — Rediseño Inventario / Formulario dinámico (desktop-first)

## Estilos globales (design tokens)
- Tipografía: Inter (o sistema), escala 12/14/16/20/24.
- Colores: fondo #F7F8FA; texto #111827; borde #E5E7EB; primario #2563EB; peligro #DC2626; éxito #16A34A.
- Botones: Primario (relleno), Secundario (borde), Peligro (relleno rojo). Hover: +8% contraste; Disabled: 40% opacidad.
- Inputs: altura 36–40px; estados: default/borde, focus (anillo primario), error (borde rojo + helper).
- Layout: contenedor max 1200px, padding 24px, grid 12 columnas; tarjetas con sombra sutil.

---

## 1) Página: Inicio de sesión
### Meta
- Title: “Iniciar sesión | Sistema Contable”
- Description: “Accede al sistema para gestionar inventario según permisos.”

### Estructura
- Layout centrado (Flexbox): card 420–480px.
- Componentes:
  - Logo + nombre del sistema.
  - Form: Email/Usuario, Contraseña, botón “Ingresar”.
  - Mensaje de error de credenciales.

### Comportamiento
- Al éxito: redirigir a “/inventario”.

---

## 2) Página: Inventario (listado)
### Meta
- Title: “Inventario | Sistema Contable”
- Description: “Listado y gestión de ítems de inventario.”

### Estructura
- Header: título + acciones a la derecha.
- Barra de acciones:
  - Buscador.
  - Botón “Nuevo ítem” (visible solo si rol permite crear).
- Tabla (CSS Grid o tabla nativa):
  - Columnas base: Identificador, Actualizado, Acciones.
  - Acciones por fila: Ver/Editar, Eliminar (según rol).

### Componentes y estados
- Empty state: “No hay ítems. Crea el primero.”
- Loading state: skeleton.
- Permisos:
  - Si no puedes editar: mostrar “Ver” en lugar de “Editar”.
  - Si no puedes eliminar: ocultar acción “Eliminar”.

### Confirmación de eliminación (obligatoria)
- Modal:
  - Título: “Confirmar eliminación”
  - Texto: “Esta acción no se puede deshacer.”
  - Botones: “Cancelar” (secundario), “Eliminar” (peligro).

---

## 3) Página: Crear/Editar ítem (formulario dinámico)
### Meta
- Title: “Ítem de inventario | Sistema Contable”
- Description: “Crear o editar ítem usando campos configurados.”

### Layout
- Estructura en 2 columnas (desktop):
  - Izquierda (8/12): formulario.
  - Derecha (4/12): panel de ayuda/resumen (opcional) con: estado de permisos, timestamps, acciones.

### Secciones y componentes
- Breadcrumbs: Inventario > Ítem.
- Form dinámico (stack vertical):
  - Renderizar campos activos por sort_order.
  - Tipos:
    - text/textarea/number/date.
    - select/multiselect: lista de opciones derivada de `options_csv` (split por coma, trim; ignorar vacíos).
  - Requeridos: asterisco + validación al guardar.
- Acciones:
  - Guardar (si rol permite).
  - Cancelar / Volver.

### Estados
- Si rol “viewer”: todos los inputs en read-only y ocultar “Guardar”.

---

## 4) Página: Configuración de Formulario de Inventario
### Meta
- Title: “Configuración de formulario | Sistema Contable”
- Description: “Define campos dinámicos del inventario y su orden.”

### Layout
- Dos paneles (desktop):
  - Izquierda (7/12): lista de campos reordenable.
  - Derecha (5/12): editor de campo (crear/editar).

### Panel izquierdo: Lista reordenable
- Cada fila (card compacta):
  - Handle de drag (icono) + Label + Type + Required.
  - Controles de orden: flecha arriba / flecha abajo (siempre disponibles aunque exista drag&drop).
  - Acciones: Editar, Eliminar.
- Drag&drop:
  - Drop indicator (línea) entre filas.
  - Al soltar: persistir nuevo `sort_order`.

### Panel derecho: Editor de campo
- Campos:
  - Key (slug) y Label.
  - Tipo (selector).
  - Requerido (switch).
  - Opciones (solo para select/multiselect):
    - Textarea/Input con placeholder: “Ej: Chico, Mediano, Grande”
    - Helper: “Separá opciones con comas. No uses JSON.”
  - Activo (checkbox).
- Acciones:
  - Guardar cambios.
  - “Nuevo campo” (limpia editor).

### Eliminación con confirmación
- Modal igual al inventario, pero texto: “Eliminar campo puede afectar formularios existentes.”

### Permisos
- Si no eres Admin: página inaccesible (redirigir) o mostrar “No autorizado” con botón volver.
