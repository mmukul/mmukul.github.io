import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'

const services = [
  ['01 / INDIVIDUAL LEARNING', 'Individual Training', 'For students, freshers, professionals and career switchers: Practical DevOps, DevSecOps, Application Security, GenAI and AI Security training with hands-on learning.', 'You get: structured learning, practical labs and guidance aligned to your career goals.', 'Individual Training'],
  ['02 / CORPORATE ENABLEMENT', 'Corporate Training', 'For organizations and engineering teams: Instructor-led, customized programs across DevOps, DevSecOps, AppSec, GenAI and AI Security.', 'You get: a focused team learning plan, demonstrations, labs and practical enablement.', 'Corporate Training'],
  ['03 / CAREER PREPARATION', 'Interview Preparation', 'For technology professionals and job seekers: Role-focused technical preparation, interview discussions, scenario-based questions and guidance for DevOps, DevSecOps, AppSec and security roles.', 'You get: focused preparation around your target role, technical depth and interview readiness.', 'Interview Preparation'],
  ['04 / CONSULTING + ADVISORY', 'Consulting & Advisory', 'For startups and organizations: Practical consulting across DevSecOps transformation, Application Security, AI Security, secure architecture and technology strategy.', 'You get: actionable recommendations, architecture guidance and an execution-focused roadmap.', 'Consulting & Advisory'],
]

export default function Services() {
  return <Screen>
    <SectionTitle kicker="SERVICES" title="Training, career support and technology consulting." text="Choose the service that matches your goal — learn, prepare, enable your team, or get expert guidance." />
    {services.map(([number, title, text, result, context]) => <View style={styles.card} key={number}>
      <Text style={styles.number}>{number}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
      <View style={styles.result}><Text style={styles.resultText}>{result}</Text></View>
      <Pressable style={styles.cta} onPress={() => router.push({ pathname: '/connect', params: { context } })}><Text style={styles.ctaText}>{title === 'Individual Training' ? 'Explore Individual Training' : title === 'Corporate Training' ? 'Discuss Corporate Training' : title === 'Interview Preparation' ? 'Discuss Interview Preparation' : 'Discuss Consulting'} <Text>→</Text></Text></Pressable>
    </View>)}
  </Screen>
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111633', borderColor: '#2a3560', borderWidth: 1, borderRadius: 18, padding: 17, marginBottom: 11 },
  number: { color: '#67e8f9', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#f8fafc', fontSize: 19, fontWeight: '900', marginTop: 9 },
  text: { color: '#aab6d4', fontSize: 13, lineHeight: 20, marginTop: 7 },
  result: { marginTop: 11, padding: 10, borderRadius: 11, backgroundColor: '#0d122d', borderColor: '#252d55', borderWidth: 1 },
  resultText: { color: '#cbd5e1', fontSize: 11.5, lineHeight: 17 },
  cta: { marginTop: 11, backgroundColor: '#67e8f9', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  ctaText: { color: '#07111f', fontSize: 10.5, fontWeight: '900' },
})
