# GESTIA — Gestión de caja e inventario para PYMES

## Descripción General
GESTIA es una plataforma web integral basada en la nube, diseñada para centralizar y optimizar la administración de pequeñas y medianas empresas. El sistema unifica la gestión financiera, el control de inventarios, la administración de almacenes y la generación de reportes avanzados en una única interfaz moderna y escalable.

Su arquitectura multi-inquilino (multi-business) permite gestionar distintas áreas de la empresa con un control estricto de roles y permisos (RBAC), adaptándose tanto a usuarios gratuitos (Freemium) como a clientes premium mediante un sistema de suscripciones dinámico.

## Módulos Principales

### 1. Finanzas (control de caja)
- **Gestión de Transacciones:** Registro de ingresos y gastos con categorización, contactos y cobros/pagos.
- **Saldo en Dos Capas:** defines un 'Saldo Inicial' (restringido a administradores) y la app calcula el 'Saldo Actual' (inicial + ingresos − gastos).
- **Multimoneda:** Soporte para múltiples monedas y tasas de conversión (limitado a 1 moneda en plan Free).
- **Dashboard Financiero:** KPIs globales y resúmenes de flujos de caja.

### 2. Almacén e Inventario Dinámico
- **Control de Stock:** Seguimiento de productos, áreas de inventario y movimientos, actualizado en cada operación.
- **Analíticas visuales:** Gráficos de tendencias de entradas/salidas y "Top 10 Productos por Stock".
- **Historial de Movimientos:** Registro de entradas y salidas por producto.

### 3. Reportes y Exportación
- **Módulo Centralizado:** Generación de informes financieros y de almacén unificados.
- **Exportación:** Descarga de reportes en PDF, Excel y Word.
- **Filtros Avanzados:** Componentes reutilizables para filtrar información por rangos de fecha personalizados (Día, Mes, Año, Trimestre).

### 4. Seguridad y Configuración
- **Roles y Permisos (RBAC):** Acceso granular a cada módulo dependiendo del rol del usuario dentro del equipo.
- **Bitácora de actividad:** Registro de quién hizo qué acción y cuándo (`Logs`).
- **Gestión de Suscripciones:** Lógica integrada para limitar recursos (usuarios, monedas, productos) en cuentas gratuitas y desbloquear potencial en planes Premium.

## Stack Tecnológico
- **Frontend:** React 18, Vite, Tailwind CSS, Shadcn UI (Radix UI).
- **Gestión de Estado y Datos:** React Query (TanStack Query), React Router, Context API.
- **Backend / Base de Datos:** Supabase (PostgreSQL, Autenticación, RPCs y Row Level Security).
- **Herramientas de Exportación:** jsPDF, xlsx, Recharts (Gráficos).

## Identidad del Proyecto
- **Nombre:** GESTIA
- **Propuesta de valor:** "Tu caja y tu inventario, simples y en un solo lugar."
