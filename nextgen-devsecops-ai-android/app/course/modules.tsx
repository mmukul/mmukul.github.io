import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Modules() {
  const { id,title } = useLocalSearchParams<{id:string,title:string}>();
  const [lessons,setLessons]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    if(!id)return;
    const {data}=await supabase.from('lessons')
      .select('id,title,description,content,video_url,sort_order')
      .eq('module_id',id).order('sort_order',{ascending:true});
    setLessons(data??[]);setLoading(false);
  })()},[id]);

  if(loading)return <View style={{flex:1,backgroundColor:'#080B14',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#7C5CFF"/></View>;

  return <ScrollView style={{flex:1,backgroundColor:'#080B14'}} contentContainerStyle={{padding:18}}>
    <Text style={{color:'#6FE7FF',fontSize:12,fontWeight:'800'}}>MODULE</Text>
    <Text style={{color:'#FFF',fontSize:24,fontWeight:'800',marginTop:5}}>{title ?? 'Lessons'}</Text>
    {lessons.length===0?<Text style={{color:'#8E99AF',marginTop:16}}>No lessons published yet.</Text>:
      lessons.map((l:any,index:number)=><Pressable key={l.id} onPress={()=>router.push({pathname:'/course/lesson',params:{id:l.id,title:l.title}})}
        style={{backgroundColor:'#111729',borderWidth:1,borderColor:'#252F49',borderRadius:15,padding:16,marginTop:12}}>
        <Text style={{color:'#7C5CFF',fontWeight:'800'}}>LESSON {index+1}</Text>
        <Text style={{color:'#FFF',fontSize:16,fontWeight:'800',marginTop:5}}>{l.title}</Text>
        {l.description?<Text style={{color:'#8E99AF',marginTop:5}}>{l.description}</Text>:null}
      </Pressable>)}
  </ScrollView>;
}
