import { beforeEach, describe, expect, it, vi } from 'vitest'

const upload = vi.fn()
const remove = vi.fn()
const getPublicUrl = vi.fn()

vi.mock('@/config/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload,
        remove,
        getPublicUrl,
      }),
    },
  },
}))

vi.mock('@/services/notifyWrap', () => ({
  withCrud: async (_meta, fn) => fn(),
}))

vi.mock('@/services/auditLogger', () => ({
  logAction: vi.fn(),
}))

vi.mock('@/services/exchangeRates', () => ({
  getRateForDate: vi.fn(async () => null),
}))

describe('P0-001 adjuntos transaction-images', () => {
  beforeEach(() => {
    upload.mockReset()
    remove.mockReset()
    getPublicUrl.mockReset()
  })

  it('uploadAttachments exige carpeta businessId', async () => {
    const { uploadAttachments } = await import('./finanzas')
    await expect(uploadAttachments([new File(['x'], 'a.png')], null)).rejects.toThrow(/businessId/)
  })

  it('uploadAttachments usa prefijo {businessId}/', async () => {
    upload.mockResolvedValue({ error: null })
    getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.test/storage/v1/object/public/transaction-images/biz-1/f.png' },
    })
    const { uploadAttachments } = await import('./finanzas')
    const file = new File(['img'], 'comp.png', { type: 'image/png' })
    await uploadAttachments([file], 'biz-1')
    expect(upload).toHaveBeenCalledTimes(1)
    const [path] = upload.mock.calls[0]
    expect(path.startsWith('biz-1/')).toBe(true)
  })

  it('deleteAttachments no intenta borrar rutas fuera del negocio', async () => {
    remove.mockResolvedValue({ error: null })
    const { deleteAttachments } = await import('./finanzas')
    await deleteAttachments(
      [
        'https://x/storage/v1/object/public/transaction-images/biz-A/a.png',
        'https://x/storage/v1/object/public/transaction-images/biz-B/b.png',
      ],
      'biz-A'
    )
    expect(remove).toHaveBeenCalledWith(['biz-A/a.png'])
  })
})
