import { supabase } from '@/config/supabase'

export async function getDowngradePreview() {
  const { data, error } = await supabase.rpc('get_my_downgrade_preview')
  if (error) throw error
  return data
}

export async function applyDowngradeToFree({ keepCurrencyId, keepAreaIds }) {
  const { data, error } = await supabase.rpc('apply_downgrade_to_free', {
    keep_currency_id: keepCurrencyId ?? null,
    keep_area_ids: keepAreaIds ?? null
  })
  if (error) throw error
  return data
}

