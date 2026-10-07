import { StyleSheet, Text, View, Linking, Pressable } from 'react-native'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'
import { theme } from '../theme'

export default function About() {
  return <Screen><SectionTitle kicker="ABOUT MUKUL" title="Building secure technology. Enabling people. Delivering transformation." text="DevSecOps & AI Security Architect, Consultant and Corporate Trainer helping organizations and technology professionals turn complex security and engineering challenges into practical, scalable outcomes." />
    <Text style={styles.body}>With <Text style={styles.bold}>20 years of total industry experience</Text>, I bring together engineering, architecture, cybersecurity, DevSecOps and modern AI security. My work spans <Text style={styles.bold}>consulting, corporate training, individual learning and interview preparation</Text>—with a strong focus on hands-on execution and real-world technology.</Text>
    <View style={styles.metrics}>
      <Metric value="20" label="Years total industry experience" />
      <Metric value="6+" label="Years individual & corporate training" />
      <Metric value="2+" label="Years AI Security experience" />
    </View>
    <View style={styles.pills}>{['DevSecOps Architect','AI Security Consultant','Corporate Trainer','Technology Consultant'].map(x => <View key={x} style={styles.pill}><Text style={styles.pillText}>{x}</Text></View>)}</View>
    <View style={styles.card}><Text style={styles.heading}>WHAT I BRING</Text><Text style={styles.sub}>From strategy to execution</Text>
      <Point title="DevSecOps & Secure Engineering" text="Practical guidance for secure CI/CD, application security, cloud-native engineering and shift-left security." />
      <Point title="AI & Application Security" text="Security-focused guidance for GenAI, LLM applications, secure architectures and emerging AI risks." />
      <Point title="Training & Career Enablement" text="Hands-on learning for individuals and organizations across DevOps, DevSecOps, AppSec and AI Security." />
      <Point title="Consulting & Advisory" text="Architecture reviews, transformation roadmaps and execution-focused technology recommendations." />
    </View>
    <View style={styles.socials}>
      <Pressable style={({ pressed }: { pressed: boolean }) => [styles.social, pressed && styles.pressed]} onPress={() => Linking.openURL('https://github.com/mmukul')}><Text style={styles.socialTitle}>GitHub</Text><Text style={styles.socialText}>Projects & code ↗</Text></Pressable>
      <Pressable style={({ pressed }: { pressed: boolean }) => [styles.social, pressed && styles.pressed]} onPress={() => Linking.openURL('https://www.linkedin.com/in/mukul-malhotra/')}><Text style={styles.socialTitle}>LinkedIn</Text><Text style={styles.socialText}>Professional profile ↗</Text></Pressable>
    </View>
  </Screen>
}
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View> }
function Point({ title, text }: { title: string; text: string }) { return <View style={styles.point}><Text style={styles.pointTitle}>{title}</Text><Text style={styles.pointText}>{text}</Text></View> }
const styles = StyleSheet.create({
  body: { color:'#AEBBD0', fontSize:12.5, lineHeight:20, marginBottom:14 }, bold:{color:theme.colors.textSoft,fontWeight:'800'},
  metrics:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12}, metric:{flex:1,minWidth:100,backgroundColor:theme.colors.surfaceAlt,borderColor:'#334A6B',borderWidth:1,borderRadius:16,padding:12}, value:{color:theme.colors.text,fontSize:25,fontWeight:'900'}, label:{color:theme.colors.muted2,fontSize:10.5,lineHeight:15,marginTop:4},
  pills:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:12}, pill:{backgroundColor:theme.colors.surfaceAlt,borderColor:'#2A3858',borderWidth:1,borderRadius:99,paddingHorizontal:10,paddingVertical:7}, pillText:{color:'#CBD5E1',fontSize:9.5,fontWeight:'800'},
  card:{backgroundColor:theme.colors.surface,borderColor:'#334A6B',borderWidth:1,borderRadius:18,padding:17}, heading:{color:theme.colors.accent,fontSize:11,fontWeight:'900',letterSpacing:1.4}, sub:{color:theme.colors.text,fontSize:14,fontWeight:'800',marginTop:4,marginBottom:10}, point:{padding:11,borderRadius:12,backgroundColor:theme.colors.surfaceAlt,borderColor:theme.colors.borderSoft,borderWidth:1,marginBottom:7}, pointTitle:{color:theme.colors.text,fontSize:11,fontWeight:'900'}, pointText:{color:theme.colors.muted2,fontSize:9.5,lineHeight:14,marginTop:4},
  socials:{flexDirection:'row',gap:9,marginTop:10}, social:{flex:1,backgroundColor:theme.colors.surfaceAlt,borderColor:theme.colors.borderSoft,borderWidth:1,borderRadius:13,padding:12}, socialTitle:{color:theme.colors.text,fontWeight:'900',fontSize:11}, socialText:{color:theme.colors.muted2,fontSize:9.5,marginTop:4},
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
})
