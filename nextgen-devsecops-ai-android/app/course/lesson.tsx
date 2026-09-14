import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Lesson() {
  const { id,title } = useLocalSearchParams<{id:string,title:string}>();
  const [lesson,setLesson]=useState<any>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    if(!id)return;
    const {data}=await supabase.from('lessons')
      .select('id,title,description,content,video_url')
      .eq('id',id).maybeSingle();
    setLesson(data);setLoading(false);
  })()},[id]);

  if(loading)return <View style={{flex:1,backgroundColor:'#080B14',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#7C5CFF"/></View>;

  return <ScrollView style={{flex:1,backgroundColor:'#080B14'}} contentContainerStyle={{padding:18}}>
    <Text style={{color:'#6FE7FF',fontSize:12,fontWeight:'800'}}>LESSON</Text>
    <Text style={{color:'#FFF',fontSize:25,fontWeight:'800',marginTop:6}}>{lesson?.title ?? title ?? 'Lesson'}</Text>
    {lesson?.description?<Text style={{color:'#AAB3C5',marginTop:10}}>{lesson.description}</Text>:null}
    {lesson?.content?<Text style={{color:'#D6DBE6',fontSize:15,lineHeight:24,marginTop:18}}>{lesson.content}</Text>:null}
    {lesson?.video_url?<Pressable onPress={()=>Linking.openURL(lesson.video_url)} style={{backgroundColor:'#7C5CFF',padding:15,borderRadius:12,marginTop:22,alignItems:'center'}}>
      <Text style={{color:'#FFF',fontWeight:'800'}}>▶ Watch Lesson Video</Text>
    </Pressable>:null}
  </ScrollView>;
}
