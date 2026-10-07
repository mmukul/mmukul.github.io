import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'
import { theme } from '../theme'

const courses = [
  ['01', 'DevOps', '₹20,000', 'Linux, Git, Jenkins, Docker, Ansible and CI/CD with practical labs.'],
  ['02', 'DevSecOps & Application Security — Foundational', '₹25,000', 'Secure CI/CD, SAST, SCA, DAST, OWASP and security automation.'],
  ['03', 'DevSecOps & Application Security — Advanced', '₹30,000', 'Runtime security, IaC security, advanced controls and Compliance as Code.'],
  ['04', 'GenAI & AI Security', '₹25,000 • Launch Offer', 'Local LLMs, RAG, AI agents and practical AI security through hands-on projects.'],
] as const

export default function Training() {
  return <Screen>
    <SectionTitle kicker="TRAINING COURSES" title="Learn practical technology skills." text="Focused training paths across DevOps, DevSecOps, Application Security, GenAI and AI Security." />
    {courses.map(([number, title, fee, description]) => <View style={styles.card} key={number}>
      <Text style={styles.number}>{number}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.fee}>{fee}</Text>
      <Text style={styles.text}>{description}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Enroll now for ${title}`} hitSlop={6} style={({ pressed }) => [styles.enrollButton, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/payment', params: { course: number === '01' ? 'devops' : number === '02' ? 'devsecops-foundational' : number === '03' ? 'devsecops-advanced' : 'genai', title } })}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.enrollButtonText}>ENROLL NOW</Text>
      </Pressable>
    </View>)}

  </Screen>
}

const styles = StyleSheet.create({
  card:{backgroundColor:'#10162A',borderColor:'rgba(103,232,249,.20)',borderWidth:1,borderRadius:15,padding:12,marginBottom:8},
  number:{color:theme.colors.accent,fontSize:9.5,fontWeight:'900',letterSpacing:1.1},
  title:{color:theme.colors.text,fontSize:16,lineHeight:21,fontWeight:'900',marginTop:5},
  fee:{color:theme.colors.accent,fontSize:10.5,fontWeight:'900',marginTop:5},
  text:{color:theme.colors.muted,fontSize:11.5,lineHeight:17,marginTop:5},
  enrollButton:{marginTop:9,minHeight:45,width:'100%',borderRadius:11,borderWidth:1,borderColor:'#A5F3FC',backgroundColor:'#2563EB',shadowColor:'#2563EB',shadowOpacity:.18,shadowRadius:7,shadowOffset:{width:0,height:3},alignItems:'center',justifyContent:'center',paddingHorizontal:14},
  enrollButtonText:{color:'#FFFFFF',fontSize:10.5,fontWeight:'900',letterSpacing:.45},
  pressed:{opacity:.82,transform:[{scale:.985}]},
})
