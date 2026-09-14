import { Linking, Pressable, Text, View } from 'react-native';
export default function CloudLab() {
  return <View style={{flex:1,backgroundColor:'#080B14',padding:20}}>
    <Text style={{color:'#6FE7FF',fontWeight:'800'}}>NEXTGEN CLOUD LAB</Text>
    <Text style={{color:'#FFF',fontSize:25,fontWeight:'800',marginTop:8}}>Practice. Build. Secure.</Text>
    <Text style={{color:'#AAB3C5',marginTop:8}}>Browser-based hands-on environments.</Text>
    <Pressable onPress={()=>Linking.openURL('https://killercoda.com/playgrounds')} style={{marginTop:20}}>
      <Text style={{color:'#6FE7FF',fontWeight:'800'}}>Launch Playground Lab →</Text>
    </Pressable>
  </View>;
}
