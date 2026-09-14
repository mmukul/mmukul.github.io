import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  async function signIn() {
    const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(error || !data.user) return Alert.alert('Login failed', error?.message ?? 'Unable to sign in.');
    const {data:p}=await supabase.from('profiles').select('role,status').eq('id',data.user.id).maybeSingle();
    if(!p || p.role!=='student' || p.status!=='active') {
      await supabase.auth.signOut();
      return Alert.alert('Access denied','This account does not have active student LMS access.');
    }
    router.replace('/(tabs)/home');
  }
  return <View style={{flex:1,backgroundColor:'#080B14',justifyContent:'center',padding:24}}>
    <Text style={{color:'#FFF',fontSize:34,fontWeight:'800'}}>NextGen</Text>
    <Text style={{color:'#6FE7FF',fontSize:22,fontWeight:'700',marginBottom:24}}>DevSecOps AI</Text>
    <TextInput placeholder="Email" placeholderTextColor="#687187" value={email} onChangeText={setEmail}
      autoCapitalize="none" keyboardType="email-address" style={{backgroundColor:'#151B2C',color:'#FFF',padding:15,borderRadius:12,marginBottom:12}} />
    <TextInput placeholder="Password" placeholderTextColor="#687187" value={password} onChangeText={setPassword}
      secureTextEntry style={{backgroundColor:'#151B2C',color:'#FFF',padding:15,borderRadius:12,marginBottom:16}} />
    <Pressable onPress={signIn} style={{backgroundColor:'#7C5CFF',padding:16,borderRadius:12,alignItems:'center'}}>
      <Text style={{color:'#FFF',fontWeight:'800'}}>Sign In</Text>
    </Pressable>
    <Text style={{color:'#78839A',textAlign:'center',marginTop:20}}>Need LMS access? Contact trainer.</Text>
  </View>;
}
