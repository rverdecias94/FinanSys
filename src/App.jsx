import { Routes, Route } from 'react-router-dom'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import SidebarLayout from '@/layouts/SidebarLayout'
import Dashboard from '@/pages/Dashboard'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Finanzas from '@/pages/Finanzas'
import Almacen from '@/pages/Almacen'
import Configuracion from '@/pages/Configuracion'
import InventarioDinamico from '@/pages/InventarioDinamico'
import Reportes from '@/pages/Reportes'
import Logs from '@/pages/Logs'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <SubscriptionProvider>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<SidebarLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/finanzas" element={<Finanzas />} />
            <Route path="/almacen" element={<Almacen />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/inventario" element={<InventarioDinamico />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/logs" element={<Logs />} />
          </Route>
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </SubscriptionProvider>
  )
}
