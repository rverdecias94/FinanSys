# Integración de Sistema de Permisos

## 📋 Resumen

Se ha implementado un sistema completo de permisos basado en roles que permite controlar el acceso de los usuarios a diferentes módulos del sistema. El sistema es **totalmente opcional** y puede ser activado/desactivado según necesites.

## 🎯 Características

### Roles Predefinidos

1. **Visualizador**
   - ✅ Ver Dashboard, Finanzas, Almacén, Inventario, Reportes
   - ✅ Filtrar datos y ver gráficos
   - ✅ Exportar reportes
   - ❌ No puede crear, editar ni eliminar
   - ❌ No accede a Configuración ni Auditoría

2. **Editor**
   - ✅ Acceso completo a Dashboard
   - ✅ Crear, editar, eliminar en Finanzas, Almacén, Inventario
   - ✅ Acceso completo a Reportes
   - ❌ No puede acceder a Configuración ni Auditoría

### Componentes Nuevos

- **PermissionModeToggle**: Switch para activar/desactivar permisos
- **PermissionAwarePage**: Wrapper que selecciona páginas según modo
- **PermissionSettings**: Panel de configuración de permisos
- **DashboardPermissions**: Visualización de permisos actuales

## 🚀 Cómo Usar

### 1. Activar el Sistema de Permisos

1. Ve a **Configuración** → **Permisos**
2. Activa el switch **"Sistema de Permisos"**
3. Opcionalmente activa **"Mostrar Switch en Navegación"**

### 2. Usar el Switch Rápido

En la barra lateral, encontrarás un switch **"Modo Permisos"** que permite:
- Activar/desactivar rápidamente el sistema
- Ver tu rol actual (Propietario/Editor/Visualizador)

### 3. Ver tus Permisos

En el **Dashboard**, cuando el modo está activo, verás:
- Tu rol actual y descripción
- Tabla con todos tus permisos por módulo
- Restricciones de acceso actuales

## 📁 Archivos Nuevos

```
src/
├── components/
│   ├── common/
│   │   ├── PermissionModeToggle.jsx    # Switch de permisos
│   │   └── PermissionAwarePage.jsx     # Wrapper de páginas
│   ├── config/
│   │   └── PermissionSettings.jsx      # Configuración de permisos
│   └── dashboard/
│       └── DashboardPermissions.jsx      # Panel de permisos
├── AppIntegrado.jsx                    # Nueva app con permisos
└── mainIntegrado.jsx                   # Punto de entrada integrado
```

## 🔧 Instalación

### Opción 1: Reemplazar App Principal (Recomendado)

1. Copia `AppIntegrado.jsx` como `App.jsx`
2. Copia `mainIntegrado.jsx` como `main.jsx`
3. Reinicia el servidor de desarrollo

### Opción 2: Uso Gradual

1. Importa los componentes que necesites
2. Usa `PermissionAwarePage` para envolver tus rutas
3. Agrega `PermissionModeToggle` donde desees

## 💡 Consejos

- **Backup**: Siempre mantén un respaldo de tu `App.jsx` original
- **Testing**: Prueba con diferentes usuarios y roles
- **Migración**: El sistema es 100% compatible con tu código existente
- **Flexibilidad**: Puedes usar solo algunos componentes si lo prefieres

## 🎛️ Personalización

### Agregar Nuevos Roles

1. Crea el rol en Supabase (tabla `roles`)
2. Asigna permisos en `role_permissions`
3. Actualiza `PermissionSettings.jsx` si deseas mostrar información

### Modificar Permisos

1. Edita los permisos en la tabla `permissions`
2. Actualiza las asignaciones en `role_permissions`
3. Los cambios se reflejan automáticamente

## 🆘 Solución de Problemas

### "No veo el switch de permisos"
- Verifica que seas propietario del negocio
- Revisa que `showPermissionToggle` esté activado
- Verifica los permisos en Configuración → Permisos

### "Los permisos no funcionan"
- Asegúrate de que el modo esté activado
- Verifica tu rol en Dashboard → Permisos
- Revisa la consola para errores

### "Quiero volver al sistema anterior"
- Simplemente desactiva el "Sistema de Permisos"
- O usa tu `App.jsx` original como backup

## 📞 Soporte

El sistema está diseñado para ser intuitivo y no requiere cambios en tu lógica de negocio existente. Si necesitas ayuda adicional, revisa:

- Los componentes en acción en la aplicación
- La configuración en Configuración → Permisos
- Los logs en la consola del navegador