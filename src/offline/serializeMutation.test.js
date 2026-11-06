import { describe, it, expect } from 'vitest'
import {
  serializeTransactionPayload,
  stripBinaryAttachments,
  payloadHasBinaryAttachments,
} from './serializeMutation'

describe('serializeMutation', () => {
  it('serializa Date a ISO y números', () => {
    const out = serializeTransactionPayload({
      date: new Date('2026-11-05T12:00:00.000Z'),
      amount: '12.5',
      contact_id: '7',
      attachments: ['https://example.com/a.png'],
    })
    expect(out.date).toBe('2026-11-05T12:00:00.000Z')
    expect(out.amount).toBe(12.5)
    expect(out.contact_id).toBe(7)
    expect(out.attachments).toEqual(['https://example.com/a.png'])
  })

  it('stripBinaryAttachments elimina File y deja strings', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const out = stripBinaryAttachments({
      attachments: [file, 'https://ok', ''],
      deleted_attachments: [file, 'https://del'],
    })
    expect(out.attachments).toEqual(['https://ok'])
    expect(out.deleted_attachments).toEqual(['https://del'])
  })

  it('payloadHasBinaryAttachments detecta File', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    expect(payloadHasBinaryAttachments({ attachments: [file] })).toBe(true)
    expect(payloadHasBinaryAttachments({ attachments: ['https://x'] })).toBe(false)
  })
})
