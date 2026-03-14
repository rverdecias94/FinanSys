import { Routes, Route } from 'react-router-dom'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { BusinessProvider } from '@/context/BusinessContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import SidebarLayout from '@/layouts/SidebarLayout'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Finanzas from '@/pages/Finanzas'
import Almacen from '@/pages/Almacen'
import Configuracion from '@/pages/Configuracion'
import InventarioDinamico from '@/pages/InventarioDinamico'
import Reportes from '@/pages/Reportes'
import Logs from '@/pages/Logs'
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
                    <Route index element={<Finanzas />} />
                  </Route>
                  <Route path="/almacen" element={<ProtectedRoute requiredPermission="warehouse.view" />}>
                    <Route index element={<Almacen />} />
                  </Route>
                  <Route path="/configuracion" element={<ProtectedRoute requiredPermission="config.view" />}>
                    <Route index element={<Configuracion />} />
                  </Route>
                  <Route path="/inventario" element={<ProtectedRoute requiredPermission="inventory.view" />}>
                    <Route index element={<InventarioDinamico />} />
                  </Route>
                  <Route path="/reportes" element={<ProtectedRoute requiredPermission="reports.view" />}>
                    <Route index element={<Reportes />} />
                  </Route>
                  <Route path="/logs" element={<ProtectedRoute requiredPermission="logs.view" />}>
                    <Route index element={<Logs />} />
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
