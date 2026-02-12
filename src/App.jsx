import { Routes, Route } from 'react-router-dom'
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
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<SidebarLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/finanzas" element={<Finanzas />} />
            <Route path="/almacen" element={<Almacen />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/inventario" element={<InventarioDinamico />} />
            <Route path="/reportes" element={<Reportes />} />
          </Route>
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  )
}
