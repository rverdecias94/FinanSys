// Mutation defaults (Capa C / outbox): reconstruyen mutationFn tras recargar
// desde IndexedDB. Las páginas SOLO pasan variables serializables + mutationKey;
// no cierran userId/businessId en un closure.
//
// Claves:
//   ['transactions', 'create'|'update']
//   ['contacts', 'create'|'update'|'delete']
//   ['account_payments', 'create']
//   ['inventory_items', 'create'|'update'|'delete']
//   ['inventory_areas', 'create'|'update']
//   ['warehouse_movements', 'create']
//   ['products', 'create'|'update']
//   ['recurring_transactions', 'create'|'update'|'delete'|'toggle']

import { createTransaction, updateTransaction, registerSale, registerPayment } from '@/services/finanzas'
import { createContact, updateContact, deleteContact } from '@/services/contacts'
import {
  createItem,
  updateItem,
  deleteItem,
  createArea,
  updateArea,
} from '@/services/dynamicInventory'
import { registerMovement, createProduct, updateProduct } from '@/services/almacen'
import {
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  setRecurringActive,
} from '@/services/recurringTransactions'
import { serializeTransactionPayload } from '@/offline/serializeMutation'
import { serializeInventoryValues } from '@/offline/optimisticInventory'
import { serializeProductPayload } from '@/offline/optimisticWarehouse'
import { serializeRecurringPayload } from '@/offline/optimisticRecurring'

export const TX_CREATE_KEY = ['transactions', 'create']
export const TX_UPDATE_KEY = ['transactions', 'update']
export const CONTACT_CREATE_KEY = ['contacts', 'create']
export const CONTACT_UPDATE_KEY = ['contacts', 'update']
export const CONTACT_DELETE_KEY = ['contacts', 'delete']
export const PAYMENT_CREATE_KEY = ['account_payments', 'create']
export const INV_ITEM_CREATE_KEY = ['inventory_items', 'create']
export const INV_ITEM_UPDATE_KEY = ['inventory_items', 'update']
export const INV_ITEM_DELETE_KEY = ['inventory_items', 'delete']
export const INV_AREA_CREATE_KEY = ['inventory_areas', 'create']
export const INV_AREA_UPDATE_KEY = ['inventory_areas', 'update']
export const WH_MOVEMENT_CREATE_KEY = ['warehouse_movements', 'create']
export const PRODUCT_CREATE_KEY = ['products', 'create']
export const PRODUCT_UPDATE_KEY = ['products', 'update']
export const RECURRING_CREATE_KEY = ['recurring_transactions', 'create']
export const RECURRING_UPDATE_KEY = ['recurring_transactions', 'update']
export const RECURRING_DELETE_KEY = ['recurring_transactions', 'delete']
export const RECURRING_TOGGLE_KEY = ['recurring_transactions', 'toggle']

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
      const rest = { ...clean }
      delete rest.client_uuid
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

  queryClient.setMutationDefaults(INV_ITEM_CREATE_KEY, {
    mutationFn: async (vars) => {
      const { areaId, values, userId, businessId, client_uuid } = vars || {}
      const effective = businessId || userId
      return createItem(
        areaId,
        serializeInventoryValues(values || {}),
        effective,
        client_uuid || null,
      )
    },
  })

  queryClient.setMutationDefaults(INV_ITEM_UPDATE_KEY, {
    mutationFn: async (vars) => {
      const { id, values, userId, businessId } = vars || {}
      const effective = businessId || userId
      return updateItem(id, serializeInventoryValues(values || {}), effective)
    },
  })

  queryClient.setMutationDefaults(INV_ITEM_DELETE_KEY, {
    mutationFn: async (vars) => {
      const { id, userId, businessId } = vars || {}
      const effective = businessId || userId
      return deleteItem(id, effective)
    },
  })

  queryClient.setMutationDefaults(INV_AREA_CREATE_KEY, {
    mutationFn: async (vars) => {
      const { payload, userId, businessId } = vars || {}
      const p = payload || {}
      return createArea({
        name: typeof p.name === 'string' ? p.name.trim() : p.name,
        icon: p.icon || 'Home',
        slug: p.slug ?? '',
        prefix: p.prefix ?? '',
        domain_type: p.domain_type || 'custom',
        template_id: p.template_id || 'custom_blank',
        client_uuid: p.client_uuid || null,
      }, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(INV_AREA_UPDATE_KEY, {
    mutationFn: async (vars) => {
      const { id, payload, userId, businessId } = vars || {}
      const clean = {
        name: typeof payload?.name === 'string' ? payload.name.trim() : payload?.name,
        icon: payload?.icon || null,
        slug: payload?.slug ?? '',
        prefix: payload?.prefix ?? '',
      }
      return updateArea(id, clean, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(WH_MOVEMENT_CREATE_KEY, {
    mutationFn: async (vars) => {
      const {
        product_id,
        qty,
        type,
        unit_cost,
        userId,
        notes,
        client_uuid,
      } = vars || {}
      return registerMovement({
        product_id,
        qty,
        type,
        unit_cost,
        userId,
        notes: notes || null,
        client_uuid: client_uuid || null,
      })
    },
  })

  queryClient.setMutationDefaults(PRODUCT_CREATE_KEY, {
    mutationFn: async (vars) => {
      const { payload, userId, businessId } = vars || {}
      return createProduct(serializeProductPayload(payload || {}), userId, businessId)
    },
  })

  queryClient.setMutationDefaults(PRODUCT_UPDATE_KEY, {
    mutationFn: async (vars) => {
      const { id, payload, userId, businessId } = vars || {}
      const clean = serializeProductPayload(payload || {})
      // update no debe tocar stock ni reenviar client_uuid
      const rest = { ...clean }
      delete rest.stock
      delete rest.client_uuid
      return updateProduct(id, rest, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(RECURRING_CREATE_KEY, {
    mutationFn: async (vars) => {
      const { payload, userId, businessId } = vars || {}
      return createRecurringTransaction(serializeRecurringPayload(payload || {}), userId, businessId)
    },
  })

  queryClient.setMutationDefaults(RECURRING_UPDATE_KEY, {
    mutationFn: async (vars) => {
      const { id, payload, userId, businessId } = vars || {}
      const clean = serializeRecurringPayload(payload || {})
      const rest = { ...clean }
      delete rest.client_uuid
      return updateRecurringTransaction(id, rest, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(RECURRING_DELETE_KEY, {
    mutationFn: async (vars) => {
      const { id, userId, businessId } = vars || {}
      return deleteRecurringTransaction(id, userId, businessId)
    },
  })

  queryClient.setMutationDefaults(RECURRING_TOGGLE_KEY, {
    mutationFn: async (vars) => {
      const { id, is_active, userId, businessId } = vars || {}
      return setRecurringActive(id, is_active, userId, businessId)
    },
  })
}
