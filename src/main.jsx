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
import { QueryClient, MutationCache, QueryCache, defaultShouldDehydrateMutation } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryPersister, CACHE_BUSTER, CACHE_MAX_AGE } from '@/offline/queryPersister';
import { clearLocalCache } from '@/offline/localCache';
import { registerMutationDefaults } from '@/offline/mutationDefaults';
import { setupSyncEngine } from '@/offline/syncEngine';
import { setupNetworkGuard, markOffline } from '@/offline/networkGuard';
import { isNetworkError, shouldTreatAsOffline } from '@/offline/isNetworkError';
import { supabase } from '@/config/supabase';
import { notify, getSupabaseErrorMessage } from '@/services/notifications';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { registerPwaUpdate } from '@/offline/registerPwaUpdate';

// PWA: actualizar y recargar en cuanto haya versión nueva (solo en build/preview).
registerPwaUpdate();
// Antes que cualquier fetch: alinea onlineManager con fallos reales de red.
setupNetworkGuard();

// Configuración del cliente de React Query
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // Offline real (navigator o Failed to fetch / DNS): no alarmar; hay caché.
      if (shouldTreatAsOffline(error) || isNetworkError(error)) {
        if (isNetworkError(error)) markOffline()
        return
      }
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
      // Red caída: el outbox / onError de la página reencola; no spamear toasts.
      if (isNetworkError(error) || shouldTreatAsOffline(error)) {
        markOffline()
        return
      }
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
    // Capa C: mutaciones sin red se pausan (outbox) y se reanudan al volver online.
    mutations: {
      networkMode: 'online',
    },
  },
});

// Outbox: mutationFn reconstruible tras recargar + resume al reconectar.
registerMutationDefaults(queryClient);
setupSyncEngine(queryClient);

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
              // Outbox: persistir mutaciones pausadas (sin red) para sobrevivir al reload.
              shouldDehydrateMutation: defaultShouldDehydrateMutation,
            },
          }}
          onSuccess={() => {
            // Tras rehidratar mutaciones pausadas, reanudar si ya hay red.
            queryClient.resumePausedMutations()
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
