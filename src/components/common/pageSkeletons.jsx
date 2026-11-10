import { useLocation } from 'react-router-dom'
import {
  Wallet, Users, HandCoins, Package, Layers, FileText, Settings,
  History, Sparkles, Shield,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Fila tipo listado — solo datos. */
export function ListingRowsSkeleton({ rows = 5, className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border bg-card p-3 sm:p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-[55%] max-w-[220px]" />
            <Skeleton className="h-3 w-[35%] max-w-[140px]" />
          </div>
          <Skeleton className="hidden h-5 w-16 sm:block" />
        </div>
      ))}
    </div>
  )
}

/** Valores de KPI (la tarjeta/título ya están pintados). */
export function KpiValuesSkeleton({ cards = 4, className }) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)} aria-hidden="true">
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** Cuerpo del panel: KPIs + gráficas + actividad (sin H1). */
export function DashboardBodySkeleton({ className }) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-label="Cargando datos del panel">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <p className="text-base font-semibold">Ingresos vs gastos</p>
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <p className="text-base font-semibold">Por categoría</p>
          <Skeleton className="h-[220px] w-full rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-base font-semibold">Actividad reciente</p>
        <ListingRowsSkeleton rows={3} />
      </div>
    </div>
  )
}

/** @deprecated alias — preferir DashboardBodySkeleton */
export function DashboardSkeleton({ className, hideHeader = false }) {
  return (
    <div className={cn('space-y-6', className)}>
      {!hideHeader && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Cómo va tu negocio?</h1>
          <p className="text-muted-foreground">Tu resumen financiero de un vistazo.</p>
        </div>
      )}
      <DashboardBodySkeleton />
    </div>
  )
}

/** Rejilla de áreas (solo cuerpo). */
export function CardsBodySkeleton({ cards = 6, className }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}
      aria-hidden="true"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="flex h-full min-w-0 flex-col gap-3 rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )
}

/** @deprecated */
export function CardsGridSkeleton(props) {
  return <CardsBodySkeleton {...props} />
}

function PageChrome({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
        {Icon ? (
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-8 w-8 text-primary" />
          </div>
        ) : null}
        <div>
          {title}
          {description ? (
            <p className="mt-1 text-sm font-normal text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </h1>
      {action ? <div className="flex gap-2">{action}</div> : null}
    </div>
  )
}

function FilterSlot({ label, width = 'sm:w-[180px]' }) {
  return (
    <div className={cn('w-full space-y-2 sm:w-auto')}>
      <p className="text-sm font-medium leading-none">{label}</p>
      <div className={cn('flex h-10 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground', width)}>
        …
      </div>
    </div>
  )
}

function TabStrip({ tabs }) {
  return (
    <div className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-md bg-muted p-1">
      {tabs.map((t, i) => (
        <div
          key={t}
          className={cn(
            'inline-flex h-9 items-center justify-center rounded-sm px-3 text-sm font-medium',
            i === 0 ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          {t}
        </div>
      ))}
    </div>
  )
}

/* ── Shells de ruta: chrome real + skeleton solo de datos ───────────────── */

function DashboardShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando panel">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Cómo va tu negocio?</h1>
        <p className="text-muted-foreground">Tu resumen financiero de un vistazo.</p>
      </div>
      <DashboardBodySkeleton />
    </div>
  )
}

function FinanzasShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando finanzas">
      <PageChrome
        icon={Wallet}
        title="Finanzas"
        action={(
          <Button disabled>
            Nueva Transacción
          </Button>
        )}
      />
      <div className="flex w-full flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end sm:gap-4 sm:p-4">
        <FilterSlot label="Periodo" width="sm:w-[200px]" />
        <FilterSlot label="Moneda" />
        <FilterSlot label="Categoría" width="sm:w-[200px]" />
      </div>
      <KpiValuesSkeleton cards={4} />
      <Card>
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingRowsSkeleton rows={5} />
        </CardContent>
      </Card>
    </div>
  )
}

function ContactosShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando contactos">
      <PageChrome
        icon={Users}
        title="Contactos"
        action={<Button disabled>Nuevo Contacto</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingRowsSkeleton rows={5} />
        </CardContent>
      </Card>
    </div>
  )
}

function CuentasShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando cuentas">
      <PageChrome icon={HandCoins} title="Por cobrar / Por pagar" />
      <Card>
        <CardHeader>
          <CardTitle>Cuentas pendientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TabStrip tabs={['Por cobrar', 'Por pagar']} />
          <ListingRowsSkeleton rows={4} />
        </CardContent>
      </Card>
    </div>
  )
}

function AlmacenShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando almacén">
      <PageChrome
        icon={Package}
        title="Almacén"
        description="Productos que compras y vendes, con stock y costo."
        action={<Button disabled variant="outline">Exportar</Button>}
      />
      <TabStrip tabs={['Productos', 'Movimientos', 'Comprobantes', 'Ubicaciones', 'Alertas']} />
      <div className="mb-2 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="col-span-2 h-[200px] w-full rounded-xl" />
      </div>
      <ListingRowsSkeleton rows={4} />
    </div>
  )
}

function InventarioShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando inventario">
      <PageChrome
        icon={Layers}
        title="Inventario"
        description="Áreas, equipos y listas personalizadas (no es el stock de venta)."
        action={<Button disabled>Crear Nueva Área</Button>}
      />
      <CardsBodySkeleton cards={6} />
    </div>
  )
}

function InventarioItemShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando ítem">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Layers className="h-6 w-6 text-primary" />
        Detalle de ítem
      </h1>
      <Card>
        <CardContent className="space-y-4 py-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

function ReportesShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando reportes">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Reportes y resúmenes</h1>
        <p className="text-muted-foreground">Consulta y exporta la información de tu negocio.</p>
      </div>
      <TabStrip tabs={['Finanzas', 'Almacén', 'Inventario', 'Antigüedad']} />
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <ListingRowsSkeleton rows={4} />
        </CardContent>
      </Card>
    </div>
  )
}

function ConfigShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando configuración">
      <PageChrome icon={Settings} title="Configuración" />
      <TabStrip tabs={['Planes', 'General', 'Monedas', 'Equipo', 'Roles']} />
      <Card>
        <CardContent className="space-y-4 py-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    </div>
  )
}

function LogsShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando auditoría">
      <PageChrome icon={History} title="Auditoría" />
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3">
          <FilterSlot label="Tipo de Reporte" width="w-full" />
          <FilterSlot label="Mes" width="w-full" />
          <FilterSlot label="Área" width="w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Actividades</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingRowsSkeleton rows={5} />
        </CardContent>
      </Card>
    </div>
  )
}

function HerramientasShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando copiloto">
      <div className="space-y-1">
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
          <Sparkles className="h-7 w-7 shrink-0 text-primary" />
          Copiloto
        </h1>
        <p className="text-sm text-muted-foreground">
          Radar, asistente e importación con foto.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <TabStrip tabs={['Radar', 'Asistente', 'Importar']} />
      <Skeleton className="h-[280px] w-full rounded-xl" />
    </div>
  )
}

function AdminShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando admin">
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <Shield className="h-5 w-5 text-primary" />
        Admin: Planes
      </h1>
      <TabStrip tabs={['Solicitudes', 'Negocios']} />
      <Card>
        <CardHeader>
          <CardTitle>Solicitudes de cambio de plan</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingRowsSkeleton rows={5} />
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Suspense del SidebarLayout: chrome del destino ya visible,
 * skeleton solo donde irán los datos.
 */
export function RouteOutletSkeleton() {
  const { pathname } = useLocation()

  if (pathname === '/' || pathname === '') return <DashboardShell />
  if (pathname.startsWith('/finanzas')) return <FinanzasShell />
  if (pathname.startsWith('/contactos')) return <ContactosShell />
  if (pathname.startsWith('/cuentas')) return <CuentasShell />
  if (pathname.startsWith('/almacen')) return <AlmacenShell />
  if (pathname.startsWith('/inventario/nuevo') || pathname.match(/^\/inventario\/[^/]+/)) {
    return <InventarioItemShell />
  }
  if (pathname.startsWith('/inventario')) return <InventarioShell />
  if (pathname.startsWith('/reportes')) return <ReportesShell />
  if (pathname.startsWith('/configuracion') || pathname.startsWith('/cuenta')) return <ConfigShell />
  if (pathname.startsWith('/logs')) return <LogsShell />
  if (pathname.startsWith('/herramientas')) return <HerramientasShell />
  if (pathname.startsWith('/admin')) return <AdminShell />

  return (
    <div className="space-y-4" role="status">
      <ListingRowsSkeleton rows={5} />
    </div>
  )
}

/** Nested ProtectedRoute: mismo criterio por ruta. */
export function PageContentSkeleton() {
  return <RouteOutletSkeleton />
}

/** Auth exterior (sin sidebar aún). */
export function FullPageSkeleton() {
  return (
    <div className="flex min-h-screen w-full items-start justify-center bg-background p-4 sm:p-8">
      <div className="w-full max-w-5xl pt-8 sm:pt-16">
        <DashboardShell />
      </div>
    </div>
  )
}

/** Compat: listados genéricos antiguos. */
export function ListingPageSkeleton() {
  return <FinanzasShell />
}

export function TabsPageSkeleton() {
  return <AlmacenShell />
}
