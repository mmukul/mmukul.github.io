import { supabase } from './supabase';

export async function getProfile(userId: string) {
  return supabase.from('profiles')
    .select('id,full_name,student_id,role,status')
    .eq('id', userId)
    .maybeSingle();
}
