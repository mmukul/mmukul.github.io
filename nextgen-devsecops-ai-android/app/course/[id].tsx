import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
export default function Course() {
  const { id } = useLocalSearchParams();
  return <View style={{flex:1,backgroundColor:'#080B14',padding:20}}>
    <Text style={{color:'#FFF',fontSize:22,fontWeight:'800'}}>Course</Text>
    <Text style={{color:'#8E99AF',marginTop:8}}>Course ID: {String(id ?? '')}</Text>
  </View>;
}
