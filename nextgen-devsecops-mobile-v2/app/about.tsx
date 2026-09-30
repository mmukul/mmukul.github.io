import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'

export default function About() {
  return <Screen><SectionTitle kicker="ABOUT MUKUL" title="Building secure technology. Enabling people. Delivering transformation." text="DevSecOps & AI Security Architect, Consultant and Corporate Trainer focused on secure engineering, practical learning and technology transformation." />
    <View style={styles.metrics}>
      <Metric value="20" label="Years of total industry experience" />
      <Metric value="6+" label="Years of Individual and corporate training experience" />
      <Metric value="2+" label="Years of AI Security experience" />
    </View>
    <View style={styles.card}><Text style={styles.heading}>WHAT I BRING</Text><Text style={styles.item}>• DevSecOps & Secure Engineering</Text><Text style={styles.item}>• AI & Application Security</Text><Text style={styles.item}>• Training & Career Enablement</Text><Text style={styles.item}>• Consulting & Advisory</Text></View>
  </Screen>
}

function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View> }

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metric: { flex: 1, minWidth: 100, backgroundColor: '#111230', borderColor: '#272851', borderWidth: 1, borderRadius: 16, padding: 14 },
  value: { color: '#f8fafc', fontSize: 28, fontWeight: '900' },
  label: { color: '#8998ba', fontSize: 11, lineHeight: 16, marginTop: 4 },
  card: { backgroundColor: '#15163b', borderColor: '#303263', borderWidth: 1, borderRadius: 18, padding: 18 },
  heading: { color: '#67e8f9', fontSize: 13, fontWeight: '900', letterSpacing: 1.4, marginBottom: 12 },
  item: { color: '#c6d0e5', fontSize: 14, marginBottom: 9 },
})
