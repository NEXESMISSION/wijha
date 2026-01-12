// Test Supabase connection
import { supabase } from './supabase'

export const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...')
    const { data, error } = await supabase.from('profiles').select('count').limit(1)
    console.log('Supabase test result:', { data, error })
    return { success: !error, error }
  } catch (err) {
    console.error('Supabase connection test failed:', err)
    return { success: false, error: err.message }
  }
}

