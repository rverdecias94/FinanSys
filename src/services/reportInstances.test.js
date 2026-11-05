import { describe, it, expect } from 'vitest'
import {
  reportTypeCode,
  companySlugFromProfile,
  hashReportDocument,
} from './reportInstances'

describe('reportInstances E6 (puro)', () => {
  it('codifica tipos y slug de empresa', () => {
    expect(reportTypeCode('finance_mgmt')).toBe('IFG')
    expect(reportTypeCode('kardex')).toBe('KDX')
    expect(companySlugFromProfile({ tradeName: 'Centro ELNAC' })).toBe('CENTROEL')
    expect(companySlugFromProfile({})).toBe('EMP')
  })

  it('hash estable para el mismo documento', async () => {
    const doc = { type: 'executive', title: 'A', kpis: [{ code: 'x', value: 1 }] }
    const a = await hashReportDocument(doc)
    const b = await hashReportDocument(doc)
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThan(8)
    const c = await hashReportDocument({ ...doc, title: 'B' })
    expect(c).not.toBe(a)
  })
})
