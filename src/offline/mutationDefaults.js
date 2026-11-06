// Mutation defaults (Capa C / outbox): reconstruyen mutationFn tras recargar
// desde IndexedDB. Las páginas SOLO pasan variables serializables + mutationKey;
// no cierran userId/businessId en un closure.
//
// Claves:
//   ['transactions', 'create'|'update']
//   ['contacts', 'create'|'update'|'delete']
//   ['account_payments', 'create']

import { createTransaction, updateTransaction, registerSale, registerPayment } from '@/services/finanzas'
import { createContact, updateContact, deleteContact } from '@/services/contacts'
import { serializeTransactionPayload } from '@/offline/serializeMutation'

export const TX_CREATE_KEY = ['transactions', 'create']
export const TX_UPDATE_KEY = ['transactions', 'update']
export const CONTACT_CREATE_KEY = ['contacts', 'create']
export const CONTACT_UPDATE_KEY = ['contacts', 'update']
export const CONTACT_DELETE_KEY = ['contacts', 'delete']
export const PAYMENT_CREATE_KEY = ['account_payments', 'create']

export function serializeContactPayload(payload = {}) {
  return {
    name: typeof payload.name === 'string' ? payload.name.trim() : payload.name,
    kind: payload.kind || 'cliente',
    phone: payload.phone || null,
    email: payload.email || null,
    notes: payload.notes || null,
    client_uuid: payload.client_uuid || null,
  }
}

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

  queryClient.setMutationDefaults(CONTACT_CREATE_KEY, {
    mutationFn: async (vars) => {
      const { payload, userId, businessId } = vars || {}
      return createContact(serializeContactPayload(payload || {}), userId, businessId)
    },
  })

  queryClient.setMutationDefaults(CONTACT_UPDATE_KEY, {
    mutationFn: async (vars) => {
      const { id, payload, userId, businessId } = vars || {}
      const clean = serializeContactPayload(payload || {})
      // update no debe reenviar client_uuid como cambio de negocio
      const { client_uuid: _cu, ...rest } = clean
      return updateContact(id, rest, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(CONTACT_DELETE_KEY, {
    mutationFn: async (vars) => {
      const { id, userId, businessId } = vars || {}
      return deleteContact(id, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(PAYMENT_CREATE_KEY, {
    mutationFn: async (vars) => {
      const { transactionId, amount, userId, businessId, client_uuid, method, note } = vars || {}
      return registerPayment(transactionId, amount, userId, businessId, {
        method: method || null,
        note: note || null,
        clientUuid: client_uuid || null,
      })
    },
  })
}
