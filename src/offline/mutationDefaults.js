// Mutation defaults (Capa C / outbox): reconstruyen mutationFn tras recargar
// desde IndexedDB. Las páginas SOLO pasan variables serializables + mutationKey;
// no cierran userId/businessId en un closure.
//
// Claves estables (ampliar aquí al cablear más entidades):
//   ['transactions', 'create'] | ['transactions', 'update']

import { createTransaction, updateTransaction, registerSale } from '@/services/finanzas'
import { serializeTransactionPayload } from '@/offline/serializeMutation'

export const TX_CREATE_KEY = ['transactions', 'create']
export const TX_UPDATE_KEY = ['transactions', 'update']

export function registerMutationDefaults(queryClient) {
  queryClient.setMutationDefaults(TX_CREATE_KEY, {
    mutationFn: async (vars) => {
      const { payload, userId, businessId } = vars || {}
      const clean = serializeTransactionPayload(payload || {})
      if (clean.isSale) {
        const salePayload = {
          date: clean.date || '',
          category: clean.category,
          description: clean.description,
          contact_id: clean.contact_id != null ? String(clean.contact_id) : '',
          status: clean.status,
          due_date: clean.due_date || '',
          payment_method: clean.payment_method || '',
        }
        return registerSale(
          salePayload,
          clean.product_id,
          clean.qty,
          clean.unit_price,
          clean.client_uuid,
        )
      }
      return createTransaction(clean, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(TX_UPDATE_KEY, {
    mutationFn: async (vars) => {
      const { id, payload, userId, businessId } = vars || {}
      const clean = serializeTransactionPayload(payload || {})
      return updateTransaction(id, clean, userId, businessId)
    },
  })
}
