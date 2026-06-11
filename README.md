# NexGest ERP (Sistema de Gestión y Contabilidad)

## Descripción General
GESTIA es una plataforma web integral basada en la nube, diseñada para centralizar y optimizar la administración de pequeñas y medianas empresas. El sistema unifica la gestión financiera, el control de inventarios, la administración de almacenes y la generación de reportes avanzados en una única interfaz moderna y escalable.

Su arquitectura multi-inquilino (multi-business) permite gestionar distintas áreas de la empresa con un control estricto de roles y permisos (RBAC), adaptándose tanto a usuarios gratuitos (Freemium) como a clientes premium mediante un sistema de suscripciones dinámico.

## Módulos Principales

### 1. Finanzas y Contabilidad
- **Gestión de Transacciones:** Registro detallado de ingresos y gastos con categorización.
- **Sistema de Balance de Dos Capas:** Control riguroso mediante un 'Balance Inicial' (restringido a administradores) y un 'Balance Actual' dinámico.
- **Multimoneda:** Soporte para múltiples monedas y tasas de conversión (limitado a 1 moneda en plan Free).
- **Dashboard Financiero:** KPIs globales y resúmenes de flujos de caja.

### 2. Almacén e Inventario Dinámico
- **Control de Stock:** Seguimiento en tiempo real de productos, áreas de inventario y movimientos.
- **Analíticas visuales:** Gráficos de tendencias de entradas/salidas y "Top 10 Productos por Stock".
- **Auditoría de Movimientos:** Trazabilidad completa de cada artículo desde su ingreso hasta su despacho.

### 3. Reportes y Exportación
- **Módulo Centralizado:** Generación de informes financieros y de almacén unificados.
- **Exportación Flexible:** Descarga de reportes en formatos PDF (con diseño tabular profesional) y Excel.
- **Filtros Avanzados:** Componentes reutilizables para filtrar información por rangos de fecha personalizados (Día, Mes, Año, Trimestre).

### 4. Seguridad y Configuración
- **Roles y Permisos (RBAC):** Acceso granular a cada módulo dependiendo del rol del usuario dentro del equipo.
- **Auditoría Global:** Log de actividades y sistema de registro de auditorías (`Logs`) para rastrear cambios sensibles.
- **Gestión de Suscripciones:** Lógica integrada para limitar recursos (usuarios, monedas, productos) en cuentas gratuitas y desbloquear potencial en planes Premium.

## Stack Tecnológico
- **Frontend:** React 18, Vite, Tailwind CSS, Shadcn UI (Radix UI).
- **Gestión de Estado y Datos:** React Query (TanStack Query), React Router, Context API.
- **Backend / Base de Datos:** Supabase (PostgreSQL, Autenticación, RPCs y Row Level Security).
- **Herramientas de Exportación:** jsPDF, xlsx, Recharts (Gráficos).

## Identidad del Proyecto
- **Nombre sugerido:** NexGest ERP / ContaSync
- **Propuesta de valor:** "Control financiero y logístico inteligente, en un solo lugar."
