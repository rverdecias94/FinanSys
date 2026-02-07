# Especificación Funcional y Diseño UX/UI: Módulo Almacén

## 1. Visión General
El módulo **Almacén** de **FinanSys** tiene como objetivo gestionar el inventario de forma sencilla y eficiente, proporcionando control sobre el stock y soporte para la toma de decisiones financieras.

## 2. Descripción Funcional

### 2.1. Gestión de Productos (Tab 1)
Permite la administración del catálogo de productos.
- **Campos del Producto**:
  - `Nombre`: Texto (Requerido).
  - `Categoría`: Selección de lista (Alimentos, Bebidas, Electrónica, etc.).
  - `Stock Actual`: Numérico (Solo lectura en edición, modificable por movimientos).
  - `Stock Mínimo`: Numérico (Umbral para alertas).
  - `Precio Unitario`: Numérico (Referencial para valorización).
- **Funcionalidades**:
  - **Listado**: Tabla con búsqueda y filtrado.
  - **Crear/Editar**: Formulario modal.
  - **Eliminar**: Con confirmación (validar si tiene movimientos previos).
  - **Alertas**: Indicador visual cuando `Stock Actual <= Stock Mínimo`.

### 2.2. Gestión de Movimientos (Tab 2)
Registra las variaciones de inventario.
- **Campos del Movimiento**:
  - `Producto`: Selección del catálogo.
  - `Tipo`: Entrada (Compra/Devolución) o Salida (Venta/Consumo).
  - `Cantidad`: Numérico positivo.
  - `Fecha`: Automática o seleccionable.
  - `Usuario`: Registro automático del responsable.
- **Funcionalidades**:
  - **Registrar**: Formulario rápido.
  - **Historial**: Tabla cronológica de movimientos.
  - **Actualización de Stock**: Automática al registrar movimiento.

### 2.3. Dashboard de Almacén (Encabezado)
Vista resumen para toma de decisiones rápidas.
- **KPIs**:
  - Total de Productos.
  - Productos en Alerta (Bajo Stock).
  - Valor Total del Inventario (Opcional).
- **Gráficos**:
  - **Distribución por Categoría** (Pie Chart).
  - **Movimientos Recientes** (Bar Chart: Entradas vs Salidas).

## 3. Estructura de Interfaz (UX)

### Layout General
- **Encabezado**: Título "Almacén" + Dashboard (KPIs y Gráficos colapsables o en grid superior).
- **Cuerpo Principal**: Sistema de Pestañas (`Tabs`).
  - **Tab Productos**: Barra de herramientas (Buscar, Nuevo Producto) + Tabla de Productos.
  - **Tab Movimientos**: Botón "Registrar Movimiento" + Tabla Histórica.

### Recomendaciones Visuales (UI)
- **Colores Semánticos**:
  - **Bajo Stock**: Rojo suave (`bg-red-50 text-red-700`) o Ambar (`bg-amber-50 text-amber-700`) para advertencias.
  - **Stock OK**: Verde (`text-green-600`).
  - **Entradas**: Azul o Verde.
  - **Salidas**: Naranja o Rojo.
- **Componentes**:
  - Usar `Cards` para los KPIs del Dashboard.
  - Usar `Badge` para Categorías y Estado.
  - Iconos `Lucide React` (`Package`, `ArrowUpRight`, `ArrowDownLeft`, `AlertTriangle`).

## 4. Aspectos Técnicos
- **Base de Datos**:
  - Tabla `products`: Agregar columna `min_stock`.
  - Tabla `movements`: Asegurar relación con `products` y `users`.
  - Tabla `product_categories`: Catálogo base de categorías.
- **Lógica de Negocio**:
  - Validación de stock negativo en salidas.
  - Cálculo de stock en tiempo real o por disparadores (triggers).
