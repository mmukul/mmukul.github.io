import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Course() {
  const { id } = useLocalSearchParams<{id:string}>();
  const [course,setCourse]=useState<any>(null);
  const [modules,setModules]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    if(!id)return;
    const {data:c}=await supabase.from('courses').select('id,title,description').eq('id',id).maybeSingle();
    const {data:m}=await supabase.from('modules').select('id,title,description,sort_order').eq('course_id',id).order('sort_order',{ascending:true});
    setCourse(c);setModules(m??[]);setLoading(false);
  })()},[id]);

  if(loading)return <View style={{flex:1,backgroundColor:'#080B14',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#7C5CFF"/></View>;

  return <ScrollView style={{flex:1,backgroundColor:'#080B14'}} contentContainerStyle={{padding:18}}>
    <Text style={{color:'#6FE7FF',fontSize:13,fontWeight:'800'}}>NEXTGEN DEVSECOPS AI</Text>
    <Text style={{color:'#FFF',fontSize:26,fontWeight:'800',marginTop:8}}>{course?.title ?? 'Course'}</Text>
    <Text style={{color:'#AAB3C5',marginTop:8,lineHeight:21}}>{course?.description ?? ''}</Text>
    <Text style={{color:'#FFF',fontSize:20,fontWeight:'800',marginTop:24,marginBottom:12}}>Modules</Text>
    {modules.length===0?<Text style={{color:'#8E99AF'}}>No modules published yet.</Text>:
      modules.map((m:any,index:number)=><Pressable key={m.id} onPress={()=>router.push({pathname:'/course/modules',params:{id:m.id,title:m.title}})}
        style={{backgroundColor:'#111729',borderWidth:1,borderColor:'#252F49',borderRadius:15,padding:16,marginBottom:10}}>
        <Text style={{color:'#6FE7FF',fontSize:12,fontWeight:'800'}}>MODULE {index+1}</Text>
        <Text style={{color:'#FFF',fontSize:16,fontWeight:'800',marginTop:5}}>{m.title}</Text>
        {m.description?<Text style={{color:'#8E99AF',marginTop:5}}>{m.description}</Text>:null}
        <Text style={{color:'#7C5CFF',marginTop:10,fontWeight:'800'}}>VIEW LESSONS →</Text>
      </Pressable>)}
  </ScrollView>;
}
