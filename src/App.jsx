import { Routes, Route } from 'react-router-dom'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { BusinessProvider } from '@/context/BusinessContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import SidebarLayout from '@/layouts/SidebarLayout'
import {
  Dashboard,
  Login,
  Signup,
  ForgotPassword,
  ResetPassword,
  FinanzasMejorado,
  AlmacenMejorado,
  InventarioMejorado,
  InventarioNuevo,
  InventarioItem,
  InventarioConfigFormulario,
  Reportes,
  ConfiguracionMejorado,
  LogsMejorado
} from '@/pages'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <BusinessProvider>
      <SubscriptionProvider>
        <CurrencyProvider>
          <PermissionProvider>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route element={<SidebarLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/finanzas" element={<ProtectedRoute requiredPermission="finanzas.view" />}>
                    <Route index element={<FinanzasMejorado />} />
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
                </Route>
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
            <Toaster position="top-right" richColors />
          </PermissionProvider>
        </CurrencyProvider>
      </SubscriptionProvider>
    </BusinessProvider>
  )
}
