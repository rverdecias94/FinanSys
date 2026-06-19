import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { BusinessProvider } from '@/context/BusinessContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import SidebarLayout from '@/layouts/SidebarLayout'
import { Toaster } from '@/components/ui/sonner'

// Code-splitting por ruta (P3.5): cada página es su propio chunk y solo se
// descarga al visitarla → el bundle inicial (login/dashboard) es mucho menor
// y las libs pesadas (recharts, jspdf/xlsx/docx) se difieren hasta usarse.
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Login = lazy(() => import('@/pages/Login'))
const Signup = lazy(() => import('@/pages/Signup'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const FinanzasMejorado = lazy(() => import('@/pages/FinanzasMejorado'))
const Contactos = lazy(() => import('@/pages/Contactos'))
const CuentasMejorado = lazy(() => import('@/pages/CuentasMejorado'))
const AlmacenMejorado = lazy(() => import('@/pages/AlmacenMejorado'))
const InventarioMejorado = lazy(() => import('@/pages/InventarioMejorado'))
const InventarioNuevo = lazy(() => import('@/pages/InventarioNuevo'))
const InventarioItem = lazy(() => import('@/pages/InventarioItem'))
const InventarioConfigFormulario = lazy(() => import('@/pages/InventarioConfigFormulario'))
const Reportes = lazy(() => import('@/pages/Reportes'))
const ConfiguracionMejorado = lazy(() => import('@/pages/ConfiguracionMejorado'))
const LogsMejorado = lazy(() => import('@/pages/LogsMejorado'))
const AdminPlans = lazy(() => import('@/pages/AdminPlans'))

const PageLoader = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
)

export default function App() {
  return (
    <BusinessProvider>
      <SubscriptionProvider>
        <CurrencyProvider>
          <PermissionProvider>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route element={<SidebarLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/finanzas" element={<ProtectedRoute requiredPermission="finanzas.view" />}>
                    <Route index element={<FinanzasMejorado />} />
                  </Route>
                  <Route path="/contactos" element={<ProtectedRoute requiredPermission="finanzas.view" />}>
                    <Route index element={<Contactos />} />
                  </Route>
                  <Route path="/cuentas" element={<ProtectedRoute requiredPermission="finanzas.view" />}>
                    <Route index element={<CuentasMejorado />} />
                  </Route>
                  <Route path="/almacen" element={<ProtectedRoute requiredPermission="warehouse.view" />}>
                    <Route index element={<AlmacenMejorado />} />
                  </Route>
                  <Route path="/inventario" element={<ProtectedRoute requiredPermission="inventory.view" />}>
                    <Route index element={<InventarioMejorado />} />
                    <Route path="nuevo" element={<ProtectedRoute requiredPermission="inventory.create" />}>
                      <Route index element={<InventarioNuevo />} />
                    </Route>
                    <Route path=":id" element={<InventarioItem />} />
                    <Route path="config-formulario" element={<InventarioConfigFormulario />} />
                  </Route>
                  <Route path="/reportes" element={<ProtectedRoute requiredPermission="reports.view" />}>
                    <Route index element={<Reportes />} />
                  </Route>
                  <Route path="/configuracion" element={<ProtectedRoute requiredPermission="config.view" />}>
                    <Route index element={<ConfiguracionMejorado />} />
                  </Route>
                  <Route path="/logs" element={<ProtectedRoute requiredPermission="logs.view" />}>
                    <Route index element={<LogsMejorado />} />
                  </Route>

                  <Route path="/admin/planes" element={<ProtectedRoute systemAdminOnly />}>
                    <Route index element={<AdminPlans />} />
                  </Route>
                </Route>
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
            </Suspense>
            <Toaster position="top-right" richColors />
          </PermissionProvider>
        </CurrencyProvider>
      </SubscriptionProvider>
    </BusinessProvider>
  )
}
