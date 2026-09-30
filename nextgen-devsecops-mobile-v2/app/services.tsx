import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'

const services = [
  ['01', 'Individual Training', 'Practical learning programs for students, professionals, freshers and career switchers.'],
  ['02', 'Corporate Training', 'Customized instructor-led programs for teams and organizations.'],
  ['03', 'Interview Preparation', 'Focused technical preparation for DevOps, DevSecOps, AppSec and security roles.'],
  ['04', 'Consulting & Advisory', 'DevSecOps, application security, AI security, architecture and technology strategy.'],
]

export default function Services() {
  return <Screen><SectionTitle kicker="SERVICES" title="Practical expertise for people and organizations" text="Training, preparation and consulting across DevOps, DevSecOps, AppSec and AI Security." />
    {services.map(([number, title, text]) => <View style={styles.card} key={number}><Text style={styles.number}>{number}</Text><Text style={styles.title}>{title}</Text><Text style={styles.text}>{text}</Text></View>)}
  </Screen>
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#121437', borderColor: '#292f5b', borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 12 },
  number: { color: '#67e8f9', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  title: { color: '#f8fafc', fontSize: 19, fontWeight: '900' },
  text: { color: '#aab6d4', fontSize: 13, lineHeight: 20, marginTop: 7 },
})
