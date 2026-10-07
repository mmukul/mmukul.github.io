import { StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { Screen } from '../components/Screen'
import { theme } from '../theme'

const URL = 'https://www.youtube.com/@DevSecOps-Experts'

export default function YouTube() {
  return <Screen>
    <View style={styles.head}>
      <Text style={styles.kicker}>FREE VIDEO LEARNING</Text>
      <Text style={styles.title}>Learn. Build. <Text style={styles.accent}>Grow.</Text></Text>
      <Text style={styles.text}>DevOps, DevSecOps, Application Security, GenAI and AI Security videos.</Text>
    </View>
    <View style={styles.webWrap}>
      <WebView source={{ uri: URL }} javaScriptEnabled domStorageEnabled thirdPartyCookiesEnabled sharedCookiesEnabled setSupportMultipleWindows={false} originWhitelist={['https://*','http://*']} startInLoadingState style={styles.web} />
    </View>
  </Screen>
}

const styles=StyleSheet.create({
  head:{marginBottom:12}, kicker:{color:theme.colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.4}, title:{color:'#fff',fontSize:28,lineHeight:34,fontWeight:'900',marginTop:5}, accent:{color:theme.colors.accent}, text:{color:theme.colors.muted,fontSize:12.5,lineHeight:19,marginTop:6},
  webWrap:{height:560,borderRadius:17,overflow:'hidden',borderWidth:1,borderColor:theme.colors.border,backgroundColor:'#0A1225'}, web:{flex:1,backgroundColor:'#0A1225'}
})
