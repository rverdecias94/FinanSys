import { Routes, Route } from 'react-router-dom'
import { SubscriptionProvider } from '@/context/SubscriptionContext'
import { CurrencyProvider } from '@/context/CurrencyContext'
import { PermissionProvider } from '@/context/PermissionContext'
import { PermissionModeProvider } from '@/context/PermissionModeContext'
import { BusinessProvider } from '@/context/BusinessContext'
import ProtectedRoute from '@/routes/ProtectedRoute'
import SidebarLayout from '@/layouts/SidebarLayout'
import { PermissionAwarePage } from '@/components/common/PermissionAwarePage'
import { Toaster } from '@/components/ui/sonner'

// Importar todas las páginas
import {
  Dashboard,
  Login,
  Signup,
  ForgotPassword,
  ResetPassword,
  Finanzas,
  Almacen,
  Configuracion,
  InventarioDinamico,
  Reportes,
  Logs,
  FinanzasMejorado,
  AlmacenMejorado,
  ConfiguracionMejorado,
  InventarioMejorado,
  ReportesMejorado,
  LogsMejorado
} from '@/pages'

export default function AppIntegrado() {
  return (
    <BusinessProvider>
      <SubscriptionProvider>
        <CurrencyProvider>
          <PermissionModeProvider>
            <PermissionProvider>
              <Routes>
                <Route element={<ProtectedRoute />}>
                  <Route element={<SidebarLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    
                    {/* Finanzas - Página consciente de permisos */}
                    <Route path="/finanzas" element={
                      <PermissionAwarePage 
                        OriginalPage={Finanzas}
                        EnhancedPage={FinanzasMejorado}
                        module="finanzas"
                      />
                    } />
                    
                    {/* Almacén - Página consciente de permisos */}
                    <Route path="/almacen" element={
                      <PermissionAwarePage 
                        OriginalPage={Almacen}
                        EnhancedPage={AlmacenMejorado}
                        module="almacen"
                      />
                    } />
                    
                    {/* Configuración - Página consciente de permisos */}
                    <Route path="/configuracion" element={
                      <PermissionAwarePage 
                        OriginalPage={Configuracion}
                        EnhancedPage={ConfiguracionMejorado}
                        module="configuracion"
                      />
                    } />
                    
                    {/* Inventario - Página consciente de permisos */}
                    <Route path="/inventario" element={
                      <PermissionAwarePage 
                        OriginalPage={InventarioDinamico}
                        EnhancedPage={InventarioMejorado}
                        module="inventario"
                      />
                    } />
                    
                    {/* Reportes - Página consciente de permisos */}
                    <Route path="/reportes" element={
                      <PermissionAwarePage 
                        OriginalPage={Reportes}
                        EnhancedPage={ReportesMejorado}
                        module="reportes"
                      />
                    } />
                    
                    {/* Logs - Página consciente de permisos */}
                    <Route path="/logs" element={
                      <PermissionAwarePage 
                        OriginalPage={Logs}
                        EnhancedPage={LogsMejorado}
                        module="logs"
                      />
                    } />
                  </Route>
                </Route>
                
                {/* Rutas públicas */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
              </Routes>
              <Toaster position="top-right" richColors />
            </PermissionProvider>
          </PermissionModeProvider>
        </CurrencyProvider>
      </SubscriptionProvider>
    </BusinessProvider>
  )
}