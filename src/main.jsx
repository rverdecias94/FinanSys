import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Fuentes auto-alojadas (PWA/offline): sustituyen al CDN de Google Fonts.
// Outfit = --font-sans/heading; JetBrains Mono = font-mono (vistas de admin).
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryPersister, CACHE_BUSTER, CACHE_MAX_AGE } from '@/offline/queryPersister';
import { clearLocalCache } from '@/offline/localCache';
import { supabase } from '@/config/supabase';
import { notify, getSupabaseErrorMessage } from '@/services/notifications';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// Configuración del cliente de React Query
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Offline (Capa B): no alarmar con "Error de carga"; se está sirviendo de la
      // caché persistida. Solo notificar errores reales cuando SÍ hay conexión.
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      // Solo notificar errores de queries si son críticos o inesperados
      // Evitar notificar 404s que a veces son esperados
      const msg = getSupabaseErrorMessage(error)
      notify.error(`Error de carga: ${msg}`)
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: (data, variables, context, mutation) => {
      // Si la mutación tiene un mensaje de éxito definido en meta, mostrarlo
      const successMessage = mutation.meta?.successMessage;
      if (successMessage) {
        notify.success(successMessage);
      } else if (mutation.meta?.showGenericSuccess) {
        notify.success("Operación realizada correctamente");
      }
    },
    onError: (error, variables, context, mutation) => {
      // Si la mutación tiene un mensaje de error específico en meta, usarlo
      // Si no, parsear el error de Supabase
      const errorMessage = mutation.meta?.errorMessage || getSupabaseErrorMessage(error);
      notify.error(errorMessage);
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1, // Reintentar una vez antes de fallar
      refetchOnWindowFocus: false,
      // Capa B: las queries deben sobrevivir en memoria lo suficiente para
      // persistirse/rehidratarse desde IndexedDB (si no, se recolectan a los 5 min).
      gcTime: CACHE_MAX_AGE,
    },
  },
});

// Seguridad de la caché offline (Capa B): la caché persistida en IndexedDB podría
// dejar ver datos de un usuario a otro en un dispositivo compartido. Por eso:
// - al cerrar sesión → se limpia la caché (memoria + IndexedDB).
// - al iniciar sesión un usuario DISTINTO al de la caché guardada → se limpia.
// (Importante para claves de query sin user_id, p. ej. ['isSystemAdmin'].)
const LAST_USER_KEY = 'gestia:lastUserId';
let lastUserId = localStorage.getItem(LAST_USER_KEY);
const clearOfflineCache = () => {
  queryClient.clear();
  queryPersister.removeClient();
  clearLocalCache();
};
supabase.auth.onAuthStateChange((event, session) => {
  const uid = session?.user?.id ?? null;
  if (event === 'SIGNED_OUT') {
    localStorage.removeItem(LAST_USER_KEY);
    lastUserId = null;
    clearOfflineCache();
  } else if (uid) {
    if (lastUserId && uid !== lastUserId) {
      clearOfflineCache();
    }
    lastUserId = uid;
    localStorage.setItem(LAST_USER_KEY, uid);
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="app-theme">
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: CACHE_MAX_AGE,
            buster: CACHE_BUSTER,
            dehydrateOptions: {
              // Solo persistir queries con datos correctos (no errores/pendientes).
              shouldDehydrateQuery: (query) => query.state.status === 'success',
            },
          }}
        >
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
