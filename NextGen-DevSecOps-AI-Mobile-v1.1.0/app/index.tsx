import { router } from 'expo-router'
import Constants from 'expo-constants'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Screen } from '../components/Screen'
import { theme } from '../theme'

export default function Home() {
  const { width } = useWindowDimensions()
  const compact = width < 370
  const appVersion = Constants.expoConfig?.version ?? '1.1.0'
  return (
    <Screen>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.brandTitleRow}>
            <Text numberOfLines={1} style={styles.brand}>NEXTGEN DEVSECOPS AI</Text>
            <View style={styles.versionBadge}><Text style={styles.versionText}>v{appVersion}</Text></View>
          </View>
          <Text numberOfLines={1} style={styles.brandSub}>SECURE ENGINEERING • PRACTICAL LEARNING</Text>
        </View>
      </View>

      <View style={styles.heroBadge}><View style={styles.liveDot} /><Text numberOfLines={1} style={styles.heroBadgeText}>DEVOPS • DEVSECOPS • APPSEC • AI SECURITY</Text></View>
      <Text style={[styles.headline, compact && styles.headlineCompact]}>DevOps, DevSecOps &amp; AI Security <Text style={styles.accent}>Training</Text></Text>
      <Text style={styles.description}>Practical DevOps, DevSecOps, Application Security, Generative AI and AI Security training with hands-on learning and secure engineering guidance.</Text>

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Explore training courses" style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => router.push('/training')}>
            <Text style={styles.primaryText}>VIEW COURSES</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open Student Login" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={() => router.push('/student-login')}>
            <Text style={styles.secondaryText}>STUDENT LOGIN</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Request a Demo Session" style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/connect', params: { context: 'Demo Session' } })}>
          <Text style={styles.demoButtonText}>REQUEST A DEMO SESSION</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Let's Connect" style={({ pressed }) => [styles.connectButton, pressed && styles.pressed]} onPress={() => router.push('/connect')}>
          <Text style={styles.connectButtonText}>LET’S CONNECT</Text>
        </Pressable>
      </View>

      <View style={styles.focusCard}>
        <Text style={styles.focusKicker}>NEXTGEN DEVSECOPS AI</Text>
        <Text style={styles.focusTitle}>Learn. Build. Secure.</Text>
        <Text style={styles.focusText}>Focused courses, curriculum PDFs and practical guidance for professionals, students and teams.</Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  brandRow:{flexDirection:'row',alignItems:'center',marginBottom:14},
  brandMark:{width:36,height:36,borderRadius:11,backgroundColor:theme.colors.surfaceAlt,borderWidth:1,borderColor:'#53658F',alignItems:'center',justifyContent:'center',marginRight:10},
  brandMarkText:{color:theme.colors.accent,fontSize:18,fontWeight:'900'},
  brandTitleRow:{flexDirection:'row',alignItems:'center',minWidth:0},
  brand:{color:theme.colors.text,fontSize:12.5,fontWeight:'900',letterSpacing:1.25,flexShrink:1},
  versionBadge:{marginLeft:7,paddingHorizontal:6,paddingVertical:3,borderRadius:7,borderWidth:1,borderColor:'#53658F',backgroundColor:'#10162A'},
  versionText:{color:'#67E8F9',fontSize:8,fontWeight:'900',letterSpacing:.2},
  brandSub:{color:theme.colors.muted2,fontSize:7,fontWeight:'800',letterSpacing:.75,marginTop:3},
  heroBadge:{alignSelf:'flex-start',maxWidth:'100%',flexDirection:'row',alignItems:'center',backgroundColor:'#10162A',borderColor:'#334A6B',borderWidth:1,borderRadius:99,paddingHorizontal:8,paddingVertical:5,marginBottom:10},
  liveDot:{width:6,height:6,borderRadius:3,backgroundColor:theme.colors.accent,marginRight:7},
  heroBadgeText:{color:'#67E8F9',fontSize:8.5,fontWeight:'900',letterSpacing:.8,flexShrink:1},
  headline:{color:theme.colors.text,fontSize:34,lineHeight:38,fontWeight:'900',letterSpacing:-1.05},
  headlineCompact:{fontSize:30,lineHeight:34},
  accent:{color:theme.colors.accent},
  description:{color:theme.colors.muted,fontSize:13,lineHeight:19,marginTop:11},
  actions:{marginTop:12,gap:6},
  actionRow:{flexDirection:'row',gap:6},
  primary:{flex:1,minHeight:44,backgroundColor:theme.colors.primaryBright,borderColor:'#A5F3FC',borderWidth:1,borderRadius:11,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},
  primaryText:{color:theme.colors.accentText,fontSize:10,fontWeight:'900',letterSpacing:.2},
  secondary:{flex:1,minHeight:44,borderColor:'#C4B5FD',backgroundColor:theme.colors.secondaryBright,borderWidth:1,borderRadius:11,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},
  secondaryText:{color:'#FFFFFF',fontSize:9.5,fontWeight:'900'},
  demoButton:{minHeight:47,borderColor:'#A5F3FC',backgroundColor:theme.colors.demoMid,shadowColor:'#7C3AED',shadowOpacity:.28,shadowRadius:10,shadowOffset:{width:0,height:4},borderWidth:1,borderRadius:11,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},
  demoButtonText:{color:'#FFFFFF',fontSize:10,fontWeight:'900',letterSpacing:.25},
  connectButton:{minHeight:45,borderColor:'#A5B4FC',backgroundColor:'#15152F',borderWidth:1,borderRadius:11,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},
  connectButtonText:{color:'#EEF2FF',fontSize:10,fontWeight:'900',letterSpacing:.25},
  focusCard:{marginTop:12,padding:13,borderRadius:18,backgroundColor:'#10162A',borderWidth:1,borderColor:'rgba(103,232,249,.28)'},
  focusKicker:{color:theme.colors.accent,fontSize:8.5,fontWeight:'900',letterSpacing:1.2},
  focusTitle:{color:'#FFF',fontSize:18,fontWeight:'900',marginTop:5},
  focusText:{color:'#AEBBD0',fontSize:11.5,lineHeight:17,marginTop:6},
  pressed:{opacity:.82,transform:[{scale:.985}]},
})
