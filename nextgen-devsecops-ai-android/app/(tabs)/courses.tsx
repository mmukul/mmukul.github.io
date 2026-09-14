import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Courses() {
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);

  const load=async()=>{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace('/auth/login');return;}
    const {data}=await supabase.from('enrollments')
      .select('id,status,course_id,courses(id,title,description)')
      .eq('student_id',user.id);
    setRows(data??[]); setLoading(false);
  };

  useFocusEffect(useCallback(()=>{load()},[]));

  if(loading)return <View style={{flex:1,backgroundColor:'#080B14',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#7C5CFF"/></View>;

  return <ScrollView style={{flex:1,backgroundColor:'#080B14'}} contentContainerStyle={{padding:18}}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true);await load();setRefreshing(false)}} tintColor="#7C5CFF" />}>
    <Text style={{color:'#FFF',fontSize:24,fontWeight:'800'}}>📚 My Courses</Text>
    <Text style={{color:'#8E99AF',marginTop:6,marginBottom:16}}>Your enrolled learning programs.</Text>
    {rows.length===0?<Text style={{color:'#8E99AF'}}>No enrolled courses available yet.</Text>:
      rows.map((r:any)=><Pressable key={r.id} onPress={()=>router.push({pathname:'/course/[id]',params:{id:r.course_id}})}
        style={{backgroundColor:'#111729',borderColor:'#252F49',borderWidth:1,borderRadius:16,padding:17,marginBottom:12}}>
        <Text style={{color:'#FFF',fontSize:18,fontWeight:'800'}}>{r.courses?.title ?? 'Course'}</Text>
        <Text style={{color:'#8E99AF',marginTop:7}}>{r.courses?.description ?? 'Open course to view modules and lessons.'}</Text>
        <Text style={{color:'#6FE7FF',marginTop:12,fontWeight:'800'}}>OPEN COURSE →</Text>
      </Pressable>)}
  </ScrollView>;
}
