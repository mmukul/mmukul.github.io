import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
export default function Certificate() {
  const { id } = useLocalSearchParams();
  return <View style={{flex:1,backgroundColor:'#080B14',padding:20}}>
    <Text style={{color:'#FFF',fontSize:22,fontWeight:'800'}}>Certificate</Text>
    <Text style={{color:'#8E99AF',marginTop:8}}>Certificate ID: {String(id ?? '')}</Text>
  </View>;
}
