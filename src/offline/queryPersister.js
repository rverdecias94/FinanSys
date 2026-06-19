import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

// Capa B (offline): persiste la caché de React Query en IndexedDB para poder VER
// los datos ya cargados sin conexión tras recargar la app.
// Ver docs/PLAN_OFFLINE_PWA.md.
const IDB_KEY = 'gestia-react-query-cache'

export const queryPersister = createAsyncStoragePersister({
  key: IDB_KEY,
  throttleTime: 1000,
  storage: {
    getItem: (key) => get(key),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
})

// Versión de la caché persistida. SUBIR este valor si cambia la FORMA de los datos
// de alguna query (invalida la caché vieja y evita rehidratar estructuras incompatibles).
export const CACHE_BUSTER = 'gestia-rq-v1'

// Cuánto tiempo se considera válida la caché persistida (y cuánto sobrevive en
// memoria: gcTime). 7 días: suficiente para trabajar offline varios días.
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7
