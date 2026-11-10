import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { lazyRetry } from '@/lib/lazyRetry'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { BusinessProvider } from '@/context/BusinessContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import BillingGate from '@/routes/BillingGate'
import SidebarLayout from '@/layouts/SidebarLayout'
import { Toaster } from '@/components/ui/sonner'
import { GlobalProgressBar } from '@/components/common/GlobalProgressBar'
import { AppInitializer } from '@/components/common/AppInitializer'
import { notify } from '@/services/notifications'
import { PWA_JUST_UPDATED_KEY } from '@/offline/registerPwaUpdate'
import { FullPageSkeleton } from '@/components/common/pageSkeletons'

// Code-splitting por ruta (P3.5): cada página es su propio chunk y solo se
// descarga al visitarla → el bundle inicial (login/dashboard) es mucho menor
// y las libs pesadas (recharts, jspdf/xlsx/docx) se difieren hasta usarse.
const Dashboard = lazyRetry(() => import('@/pages/Dashboard'))
const Login = lazyRetry(() => import('@/pages/Login'))
const Signup = lazyRetry(() => import('@/pages/Signup'))
const ForgotPassword = lazyRetry(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazyRetry(() => import('@/pages/ResetPassword'))
const FinanzasMejorado = lazyRetry(() => import('@/pages/FinanzasMejorado'))
const Contactos = lazyRetry(() => import('@/pages/Contactos'))
const CuentasMejorado = lazyRetry(() => import('@/pages/CuentasMejorado'))
const AlmacenMejorado = lazyRetry(() => import('@/pages/AlmacenMejorado'))
const InventarioMejorado = lazyRetry(() => import('@/pages/InventarioMejorado'))
const InventarioNuevo = lazyRetry(() => import('@/pages/InventarioNuevo'))
const InventarioItem = lazyRetry(() => import('@/pages/InventarioItem'))
const InventarioConfigFormulario = lazyRetry(() => import('@/pages/InventarioConfigFormulario'))
const Reportes = lazyRetry(() => import('@/pages/Reportes'))
const ConfigRedirect = lazyRetry(() => import('@/pages/cuenta/ConfigRedirect'))
const PlanPage = lazyRetry(() => import('@/pages/cuenta/PlanPage'))
const NegocioPage = lazyRetry(() => import('@/pages/cuenta/NegocioPage'))
const MonedasPage = lazyRetry(() => import('@/pages/cuenta/MonedasPage'))
const AparienciaPage = lazyRetry(() => import('@/pages/cuenta/AparienciaPage'))
const EquipoPage = lazyRetry(() => import('@/pages/cuenta/EquipoPage'))
const LogsMejorado = lazyRetry(() => import('@/pages/LogsMejorado'))
const Herramientas = lazyRetry(() => import('@/pages/Herramientas'))
const AdminPlans = lazyRetry(() => import('@/pages/AdminPlans'))
const PagoAtrasado = lazyRetry(() => import('@/pages/PagoAtrasado'))
const Terminos = lazyRetry(() => import('@/pages/Terminos'))
const Privacidad = lazyRetry(() => import('@/pages/Privacidad'))

export default function App() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PWA_JUST_UPDATED_KEY) !== '1') return
      sessionStorage.removeItem(PWA_JUST_UPDATED_KEY)
      notify.success('Hay una nueva versión de Gestia', {
        description: 'Ya estás usando la versión más reciente.',
      })
    } catch {
      // sessionStorage no disponible
    }
  }, [])

  return (
    <>
      <GlobalProgressBar />
      <BusinessProvider>
      <SubscriptionProvider>
        <CurrencyProvider>
          <PermissionProvider>
            <AppInitializer>
            <Suspense fallback={<FullPageSkeleton />}>
            <Routes>
              <Route element={<ProtectedRoute />}>
                {/* Ruta auxiliar: autenticado pero sin panel (pago vencido / suspendido). */}
                <Route path="/pago-atrasado" element={<PagoAtrasado />} />
                <Route element={<BillingGate />}>
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
                    <Route path="/herramientas" element={<ProtectedRoute requiredPermission="finanzas.view" />}>
                      <Route index element={<Herramientas />} />
                    </Route>
                    <Route path="/configuracion" element={<ProtectedRoute requiredPermission="config.view" />}>
                      <Route index element={<ConfigRedirect />} />
                    </Route>
                    <Route path="/cuenta/plan" element={<ProtectedRoute requiredPermission="config.view" />}>
                      <Route index element={<PlanPage />} />
                    </Route>
                    <Route path="/cuenta/negocio" element={<ProtectedRoute requiredPermission="config.view" />}>
                      <Route index element={<NegocioPage />} />
                    </Route>
                    <Route path="/cuenta/monedas" element={<ProtectedRoute requiredPermission="config.view" />}>
                      <Route index element={<MonedasPage />} />
                    </Route>
                    <Route path="/cuenta/apariencia" element={<ProtectedRoute requiredPermission="config.view" />}>
                      <Route index element={<AparienciaPage />} />
                    </Route>
                    <Route path="/cuenta/equipo" element={<ProtectedRoute requiredPermission="team.manage" />}>
                      <Route index element={<EquipoPage />} />
                    </Route>
                    <Route path="/logs" element={<ProtectedRoute requiredPermission="logs.view" />}>
                      <Route index element={<LogsMejorado />} />
                    </Route>
                    <Route path="/cuenta" element={<Navigate to="/cuenta/negocio" replace />} />

                    <Route path="/admin/planes" element={<ProtectedRoute systemAdminOnly />}>
                      <Route index element={<AdminPlans />} />
                    </Route>
                  </Route>
                </Route>
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/privacidad" element={<Privacidad />} />
            </Routes>
            </Suspense>
            </AppInitializer>
            <Toaster position="top-right" richColors />
          </PermissionProvider>
        </CurrencyProvider>
      </SubscriptionProvider>
      </BusinessProvider>
    </>
  )
}
