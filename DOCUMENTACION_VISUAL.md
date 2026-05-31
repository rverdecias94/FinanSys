# Documentación de Ingeniería Visual y Sistema de Diseño

Este documento describe exhaustivamente el análisis a nivel de ingeniería visual de todas las pantallas, menús y componentes de la aplicación "Sistema Contable".

---

## 1. Sistema de Diseño Base

El sistema de diseño está construido sobre una arquitectura escalable, utilizando Tailwind CSS y variables CSS (`hsl`) para soportar modos claro y oscuro.

### Paleta de Colores
- **Background**: `hsl(210 20% 97%)` (Modo claro) / `hsl(210 30% 12%)` (Modo oscuro).
- **Foreground**: `hsl(210 50% 14%)` / `hsl(0 0% 98%)`.
- **Primary**: `hsl(160 60% 35%)` (Verde esmeralda/teal). Texto primario: `#ffffff`.
- **Secondary**: `hsl(200 30% 92%)`.
- **Destructive**: `hsl(0 70% 50%)` (Rojo para alertas y borrados).
- **Muted**: `hsl(200 20% 92%)` para fondos secundarios y bordes suaves.
- **Gráficos (Chart Colors)**: Paleta definida por 5 tonos principales que abarcan rojos, teals, azules oscuros, amarillos y naranjas.

### Tipografía
- **Familia Global**: `Inter`, `Barlow`, `sans-serif`.
- **Jerarquía Tipográfica**:
  - `h1`: 24px (sm: 30px), font-weight: 700 (bold), tracking-tight.
  - `h2`: 20px, font-weight: 600 (semibold).
  - `Text Base`: 16px (móvil) / 15.5px (tablet) / 15px (desktop).
  - `Text Small`: 14px (móvil pequeño <320px).

### Grid y Espaciado
- **Layout Base**: Grid de CSS en Desktop (`lg:grid-cols-[240px_1fr]`).
- **Espaciado Uniforme (Spacing)**: Escala de 4px (p. ej., `p-4` = 16px, `space-y-8` = 32px).
- **Border Radius**: Base de `0.5rem` (8px). Botones y tarjetas usan `rounded-lg` o `rounded-md`.

---

## 2. Pantallas de la Aplicación

### 2.1. Pantalla de Autenticación (Login / Signup)
#### 1. Diagrama de Flujo de Navegación
- **Ruta**: `/login` o `/signup`
- **Accesos**: Redirección automática si no hay sesión activa.
- **Enlaces**: "Registrarse" (hacia `/signup`), "¿Olvidaste tu contraseña?" (hacia `/forgot-password`).

#### 2. Layout Estructural
- **Centrado Absoluto**: Flexbox `min-h-screen flex items-center justify-center bg-gray-50/50`.
- **Contenedor Principal**: Tarjeta central blanca `max-w-md w-full p-8 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100`.

#### 3. Elementos Interactivos y Estáticos
- **Logo**: Imagen central, contenedor `h-40 w-60 rounded-full`, `object-contain`.
- **Textos**: 
  - Título "Bienvenido": 24px, bold, `text-gray-900`.
  - Subtítulo: 14px, `text-gray-500`.
- **Campos de Entrada (Inputs)**:
  - Altura: `h-11` (44px).
  - Fondo: `bg-gray-50/50`, border `gray-200`.
  - Estados: Focus cambia a `bg-white` con `ring-1 ring-primary`.
  - Botón "Ver contraseña": Icono absoluto a la derecha (`right-3 top-1/2`), `text-gray-400` hover `text-gray-600`.
- **Botón Principal (Submit)**:
  - Variante: `default` (`bg-primary text-primary-foreground`).
  - Tamaño: `w-full h-11`.
  - Tipografía: 16px (`text-base`), font-medium.
  - Estado Carga: Muestra icono `Loader2` (animación spin) y desactiva puntero (`disabled:opacity-50`).

#### 4. Reglas de Responsividad
- **Móvil (<768px)**: Padding reducido a `px-4 py-12`.
- **Desktop (>1024px)**: El contenedor max-w-md mantiene el ancho fijo (448px) al centro de la pantalla.

#### 5. Accesibilidad
- Las etiquetas de formulario (`label`) están explícitamente vinculadas a sus inputs. 
- Contraste de textos gris oscuro sobre blanco cumple la norma WCAG AA (ratio > 4.5:1).
- Navegación con tecla `Tab` habilitada con anillos de focus visibles (`focus-visible:ring-1`).

---

### 2.2. Dashboard (Panel General)
#### 1. Diagrama de Flujo de Navegación
- **Ruta**: `/`
- **Accesos directos**: Primer enlace en el Sidebar.
- **Enlaces salientes**: Accesos rápidos a `/finanzas`, `/almacen`, `/configuracion`.

#### 2. Layout Estructural
- Grid de 1 columna principal en móvil, expandible según viewport.
- **Header interno**: Flex row con título y toggle de permisos.
- **KPI Cards**: Grid `grid-cols-2 md:grid-cols-5`.
- **Gráficos**: Grid `md:grid-cols-2 lg:grid-cols-7`. Gráfico de barras ocupa 4 columnas (`lg:col-span-4`), Gráfico de pastel ocupa 3 (`lg:col-span-3`).

#### 3. Elementos Interactivos y Estáticos
- **Tarjetas de KPI (Cards)**:
  - Fondo: `bg-card` (Blanco en claro, gris oscuro en dark).
  - Borde: 1px sólido `border-border`, `rounded-lg`.
  - Título: 14px, `font-medium`. Iconos (Wallet, TrendingUp) de 16x16px.
  - Valores numéricos: 20px a 24px (`text-xl sm:text-2xl`), bold. Colores de estado: Verde (`text-green-600`) para ingresos, Rojo (`text-red-600`) para gastos.
- **Gráficos (Recharts)**:
  - BarChart (Resumen Financiero): Barras con border-radius superior (`radius={[4, 4, 0, 0]}`). Tooltips interactivos con sombreado.
  - PieChart (Distribución): Colores iterativos (`COLORS_INCOME`, `COLORS_EXPENSE`). Efecto hover nativo del SVG.
- **Filtros (Selects)**:
  - Menús desplegables nativos personalizados. `h-8` (32px), `text-xs`.
  - Interacción: Click abre `SelectContent` con items interactivos, fondo `bg-popover`.

#### 4. Reglas de Responsividad
- **Móvil (<768px)**: Las KPI cards pasan a 2 columnas. Títulos reducen a 24px (`text-2xl`). Selects ocupan ancho completo `w-full`.
- **Tablet (768px-1024px)**: Gráficos ocupan 100% de la fila (`md:col-span-2`).
- **Desktop (>1024px)**: Distribución 4/3 para gráficos. KPI en 5 columnas.

#### 5. Accesibilidad
- Tooltips en gráficos para lectura de datos por point-and-click.
- Textos secundarios mantienen `text-muted-foreground` con suficiente contraste.

---

### 2.3. Finanzas, Almacén, Inventario, Reportes y Auditoría (Pantallas Estándar de Gestión)
*Estas pantallas comparten un estándar visual de tablas de datos y paginación.*

#### 1. Diagrama de Flujo de Navegación
- **Ruta**: `/finanzas`, `/almacen`, `/inventario`, `/reportes`, `/logs`.
- **Accesos**: Accesibles desde el menú lateral. Requieren permisos específicos (ej. `finanzas.view`).

#### 2. Layout Estructural
- **Header**: Título de módulo, botones de acción principal alineados a la derecha (Ej: "Nueva Transacción", "Nuevo Producto").
- **Filtros**: Componente `DateRangeFilter` y Selects alineados en barra superior o tarjetas superiores.
- **Tabla de Datos**: Ocupa el espacio principal con scroll horizontal en desbordamiento.
- **Footer de Tabla**: Paginación unificada.

#### 3. Elementos Interactivos y Estáticos
- **Botones de Acción**:
  - Botón "Nuevo": `variant="default"`, incluye icono `Plus` a la izquierda.
  - Botones de Fila (Acciones): `variant="ghost" size="icon"`, iconos de 16x16px (Editar, Borrar).
- **Tablas (`Table` UI Component)**:
  - Cabeceras (`th`): `text-muted-foreground`, alineación izquierda, font-medium.
  - Filas (`tr`): `hover:bg-muted/50` transición de color. Borde inferior `border-b`.
  - Alternancia de colores: Implementado vía CSS base o clases `even:bg-muted/20`.
- **Paginación (Estándar Unificado)**:
  - Selectores: Selector de cantidad de filas (5, 10, 20, 50).
  - Botones: ChevronLeft/ChevronRight, `variant="outline" size="icon"`.
  - Texto de Estado: "Página X de Y", 14px, `text-muted-foreground`.

#### 4. Reglas de Responsividad
- **Móvil (<768px)**: Las tablas activan scroll horizontal nativo `overflow-x-auto`. Filtros se apilan verticalmente.
- **Desktop (>1024px)**: Elementos de tabla expandidos, filtros en línea `flex-row`.

#### 5. Accesibilidad
- Tablas utilizan marcado semántico (`thead`, `tbody`, `tr`, `td`, `th`).
- Navegación por teclado en las acciones de fila.
- Soporte para Screen Readers en los menús desplegables y modales de creación (Dialogs con `aria-describedby` y `aria-labelledby`).

---

### 2.4. Configuración
#### 1. Diagrama de Flujo de Navegación
- **Ruta**: `/configuracion`
- **Accesos**: Icono "Engranaje" en Sidebar inferior o listado principal.

#### 2. Layout Estructural
- Navegación por pestañas (`Tabs`).
- Listado vertical en móvil, navegación lateral en desktop (dependiendo de la variante del layout de tabs).

#### 3. Elementos Interactivos y Estáticos
- **Tabs (Pestañas)**:
  - `TabsList`: Contenedor gris `bg-muted` con border radius `rounded-md`.
  - `TabsTrigger`: Botones que al estar `data-[state=active]` adquieren `bg-background text-foreground shadow-sm`.
- **Interruptores (Switches / Toggles)**:
  - Color de encendido: `bg-primary`.
  - Tamaño: Ancho 44px, alto 24px. Pulgar (Thumb) de 20x20px con traslación en X de 20px al activarse.
- **Gestión de Permisos (Freemium)**:
  - Alertas informativas: Componente `Alert`, variante default o warning (amarillo), requiere plan Premium para desbloquear funciones.

#### 4. Reglas de Responsividad
- **Móvil (<768px)**: Las pestañas tienen scroll horizontal (`overflow-x-auto`) y ocultan la barra de desplazamiento (`scrollbar-width: none`).

---

## 3. Consolidación de Menús de la Aplicación

### 3.1. Menú Principal Lateral (Sidebar)
- **Ubicación**: Lado izquierdo, anclado `fixed` o estático en Desktop, superpuesto con z-index 50 en Móvil.
- **Ancho**: Fijo de `240px` (`w-64`).
- **Estados**:
  - Expandido (Desktop / Toggle Móvil): Visible.
  - Colapsado (Móvil): `-translate-x-full`.
- **Fondo**: `bg-card` (blanco/gris oscuro). Borde derecho `border-r`.
- **Elementos de Navegación (`NavLink`)**:
  - Altura y padding: `px-3 py-2`.
  - Estado Inactivo: `text-muted-foreground hover:bg-accent hover:text-accent-foreground`.
  - Estado Activo: `bg-primary text-primary-foreground` (Verde con texto blanco).
- **Footer del Sidebar**: 
  - Muestra Email del usuario con truncado `truncate max-w-[120px]`.
  - Botón de Logout: Icono `LogOut` (16x16px), variante `ghost`.
  - Etiqueta de Plan: "Plan Gratuito" (`bg-muted`) / "Plan Premium" (`bg-primary/10 text-primary`).

### 3.2. Menú Superior de Navegación (Mobile Header)
- **Visibilidad**: Solo visible en `lg:hidden` (menor a 1024px).
- **Posición**: `sticky top-0 z-30`.
- **Elementos**:
  - Botón Hamburguesa (`Menu` icon, 20x20px) para desplegar el Sidebar Lateral.
  - Texto central "Menú" (16px, semibold).
- **Interacción**: Al presionar, un Overlay negro translúcido (`bg-black/50 z-40`) oscurece el contenido principal.

### 3.3. Menús Contextuales y Desplegables (Dropdowns / Selects)
- **Contenedores de Popover/Select**:
  - Renderizados a través de portales de Radix UI para evitar problemas de `z-index` y `overflow`.
  - Estilos: `bg-popover text-popover-foreground shadow-md border rounded-md`.
  - Animaciones: `animate-in fade-in-80 zoom-in-95` para apertura fluida.
- **Elementos de Lista (`SelectItem` / `DropdownMenuItem`)**:
  - Padding: `px-2 py-1.5`.
  - Hover: `focus:bg-accent focus:text-accent-foreground` nativo manejado por teclado (flechas) y mouse.
  - Estado seleccionado: Muestra marca de verificación (`Check` icon) a la izquierda o derecha.

---
*Este documento consolida la identidad visual y funcional del sistema, garantizando consistencia a lo largo de las vistas de Finanzas, Almacén, Inventario y Reportes.*
file_path: