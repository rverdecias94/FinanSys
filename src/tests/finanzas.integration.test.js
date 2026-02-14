import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from '@/config/supabase'
import { updateBalanceConfig, createTransaction, getBalanceConfig } from '../services/finanzas'

// Note: This integration test requires a real Supabase instance and a test user
// Run with: `vitest run src/tests/finanzas.integration.test.js`
// Make sure .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

describe('Balance System Integration', () => {
  let testUserId
  let initialConfig

  beforeAll(async () => {
    // Attempt to get user session. If none, integration tests might fail or need setup.
    // In a CI environment, you would sign in a test user here.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.warn('Skipping integration tests: No active session found. Please sign in or configure test user.')
      return
    }
    testUserId = session.user.id
  })

  it('should verify balance separation and calculation', async () => {
    if (!testUserId) return // Skip if no user

    // 1. Set Initial Balance
    const initialUsd = 1000
    const initialCup = 2000
    await updateBalanceConfig(testUserId, initialUsd, initialCup)
    
    let config = await getBalanceConfig(testUserId)
    expect(Number(config.initial_balance_usd)).toBe(initialUsd)
    
    // 2. Create Transaction (Income USD 500)
    const transaction = await createTransaction({
      user_id: testUserId,
      amount: 500,
      currency: 'USD',
      type: 'income',
      date: new Date().toISOString(),
      category: 'Test Income',
      description: 'Integration Test Income'
    })

    // 3. Check Total Balance (Should be Initial + Transaction = 1500)
    // Wait for DB trigger propagation if necessary (usually immediate for single connection)
    config = await getBalanceConfig(testUserId)
    expect(Number(config.initial_balance_usd)).toBe(initialUsd) // Initial stays fixed
    expect(Number(config.balance_total_usd)).toBe(1500) // Total updates dynamically

    // 4. Update Initial Balance (to 2000)
    // New Total should be: New Initial (2000) + Net Transactions (+500) = 2500
    await updateBalanceConfig(testUserId, 2000, initialCup)
    
    config = await getBalanceConfig(testUserId)
    expect(Number(config.initial_balance_usd)).toBe(2000)
    expect(Number(config.balance_total_usd)).toBe(2500)

    // 5. Verify Audit Log
    const { data: logs } = await supabase
      .from('balance_audit_log')
      .select('*')
      .eq('user_id', testUserId)
      .order('changed_at', { ascending: false })
      .limit(1)
      
    expect(logs[0].action_type).toBe('UPDATE_INITIAL')
    expect(Number(logs[0].new_initial_usd)).toBe(2000)

    // Clean up transaction
    await supabase.from('transactions').delete().eq('id', transaction.id)
  })
})
