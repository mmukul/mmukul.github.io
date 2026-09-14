import { supabase } from './supabase';

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function getProfile(userId: string) {
  return supabase.from('profiles')
    .select('id,full_name,student_id,role,status')
    .eq('id', userId)
    .maybeSingle();
}

export async function getEnrolledCourses(userId: string) {
  return supabase.from('enrollments')
    .select('id,status,course_id,courses(id,title,description)')
    .eq('student_id', userId);
}

export async function getCourseModules(courseId: string) {
  return supabase.from('modules')
    .select('id,title,description,sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });
}

export async function getModuleLessons(moduleId: string) {
  return supabase.from('lessons')
    .select('id,title,description,content,video_url,sort_order')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true });
}
