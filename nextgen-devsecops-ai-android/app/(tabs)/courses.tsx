import { Text, View } from 'react-native';
export default function Courses() {
  return <View style={{flex:1,backgroundColor:'#080B14',padding:20}}>
    <Text style={{color:'#FFF',fontSize:22,fontWeight:'800'}}>📚 My Courses</Text>
    <Text style={{color:'#8E99AF',marginTop:10}}>Enrolled courses will load from Supabase.</Text>
  </View>;
}
