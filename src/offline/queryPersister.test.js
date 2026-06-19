// Polyfill de IndexedDB en jsdom para poder ejercitar el persister REAL (idb-keyval).
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { persistQueryClientSave, persistQueryClientRestore } from '@tanstack/react-query-persist-client'
import { clear } from 'idb-keyval'
import { queryPersister, CACHE_BUSTER, CACHE_MAX_AGE } from './queryPersister'

// Capa B: prueba que la persistencia en IndexedDB hace un ciclo completo real
// (guardar → cliente nuevo vacío → rehidratar) y que el buster invalida correctamente.
describe('queryPersister (ciclo real en IndexedDB)', () => {
  beforeEach(async () => {
    await clear() // dejar el store limpio entre tests
  })

  it('persiste y rehidrata los datos de una query', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } } })
    client.setQueryData(['transactions', 'demo'], [{ id: 1, amount: 100 }])

    await persistQueryClientSave({ queryClient: client, persister: queryPersister, buster: CACHE_BUSTER })

    // Cliente nuevo y vacío: simula "recargar la app sin conexión".
    const restored = new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } } })
    expect(restored.getQueryData(['transactions', 'demo'])).toBeUndefined()

    await persistQueryClientRestore({
      queryClient: restored,
      persister: queryPersister,
      maxAge: CACHE_MAX_AGE,
      buster: CACHE_BUSTER,
    })

    expect(restored.getQueryData(['transactions', 'demo'])).toEqual([{ id: 1, amount: 100 }])
  })

  it('NO rehidrata si el buster cambió (forma de datos vieja)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } } })
    client.setQueryData(['transactions', 'demo'], [{ id: 1, amount: 100 }])
    await persistQueryClientSave({ queryClient: client, persister: queryPersister, buster: CACHE_BUSTER })

    const restored = new QueryClient({ defaultOptions: { queries: { gcTime: CACHE_MAX_AGE } } })
    await persistQueryClientRestore({
      queryClient: restored,
      persister: queryPersister,
      maxAge: CACHE_MAX_AGE,
      buster: 'buster-distinto',
    })

    expect(restored.getQueryData(['transactions', 'demo'])).toBeUndefined()
  })
})
