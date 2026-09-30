import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'

const capabilities = ['DevOps', 'DevSecOps', 'Application Security', 'GenAI & AI Security']

export default function Home() {
  return (
    <Screen>
      <View style={styles.brandRow}><View style={styles.dot} /><Text style={styles.brand}>NEXTGEN DEVSECOPS AI</Text></View>
      <Text style={styles.kicker}>DEVSECOPS • APPSEC • AI SECURITY</Text>
      <Text style={styles.headline}>Engineer.{"\n"}Secure.{"\n"}<Text style={styles.accent}>Transform.</Text></Text>
      <Text style={styles.description}>DevSecOps & AI Security Architect, Trainer and Consultant helping teams modernize delivery, strengthen application security and build secure GenAI solutions.</Text>

      <View style={styles.pills}>{capabilities.map(item => <View style={styles.pill} key={item}><Text style={styles.pillText}>{item}</Text></View>)}</View>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>NEXTGEN IN ONE PLACE</Text>
        <Text style={styles.cardTitle}>Training. Consulting. Security.</Text>
        <Text style={styles.cardText}>Explore services, training engagements and connect directly for your requirement.</Text>
        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => router.push('/services')}><Text style={styles.primaryText}>VIEW SERVICES</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/connect')}><Text style={styles.secondaryText}>LET'S CONNECT</Text></Pressable>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <Pressable style={styles.quick} onPress={() => router.push('/training')}><Text style={styles.quickNumber}>01</Text><Text style={styles.quickTitle}>Training Delivered</Text></Pressable>
        <Pressable style={styles.quick} onPress={() => router.push('/about')}><Text style={styles.quickNumber}>02</Text><Text style={styles.quickTitle}>About Mukul</Text></Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#67e8f9', marginRight: 10 },
  brand: { color: '#dbeafe', fontSize: 14, fontWeight: '900', letterSpacing: 1.8 },
  kicker: { color: '#8b7cff', fontSize: 11, fontWeight: '900', letterSpacing: 2.2, marginBottom: 20 },
  headline: { color: '#f8fafc', fontSize: 50, lineHeight: 51, fontWeight: '900', letterSpacing: -1.8 },
  accent: { color: '#69b9ff' },
  description: { color: '#b9c5df', fontSize: 15, lineHeight: 23, marginTop: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 19 },
  pill: { borderColor: '#26315b', borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  pillText: { color: '#cbd5e1', fontWeight: '800', fontSize: 11 },
  card: { marginTop: 24, padding: 18, borderRadius: 20, backgroundColor: '#121437', borderWidth: 1, borderColor: '#303461' },
  cardKicker: { color: '#67e8f9', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  cardTitle: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 7 },
  cardText: { color: '#9eadd0', fontSize: 13, lineHeight: 20, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 },
  primary: { flex: 1, backgroundColor: '#22d3ee', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#07111f', fontSize: 11, fontWeight: '900' },
  secondary: { flex: 1, borderColor: '#34406f', borderWidth: 1, borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: '#dbeafe', fontSize: 11, fontWeight: '900' },
  quickGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quick: { flex: 1, backgroundColor: '#0f1030', borderWidth: 1, borderColor: '#242953', borderRadius: 16, padding: 15 },
  quickNumber: { color: '#a78bfa', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  quickTitle: { color: '#e5e7eb', fontSize: 13, fontWeight: '800', marginTop: 6 },
})
