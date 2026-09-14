import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <View style={{flex:1,backgroundColor:'#080B14',alignItems:'center',justifyContent:'center'}}>
      <ActivityIndicator size="large" color="#7C5CFF" />
    </View>;
  }
  return <Redirect href={signedIn ? '/(tabs)/home' : '/auth/login'} />;
}
