import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'

const capabilities = ['DevOps', 'DevSecOps', 'AppSec', 'AI Security']

export default function Home() {
  return (
    <Screen>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View>
        <View><Text style={styles.brand}>NEXTGEN DEVSECOPS AI</Text><Text style={styles.brandSub}>SECURE ENGINEERING • PRACTICAL LEARNING</Text></View>
      </View>

      <View style={styles.heroBadge}><View style={styles.liveDot} /><Text style={styles.heroBadgeText}>DEVSECOPS • APPSEC • AI SECURITY</Text></View>
      <Text style={styles.headline}>Engineer.{"\n"}Secure.{"\n"}<Text style={styles.accent}>Transform.</Text></Text>
      <Text style={styles.description}>DevSecOps & AI Security Architect, Consultant and Corporate Trainer helping organizations and technology professionals build secure, modern technology capabilities.</Text>

      <View style={styles.pills}>{capabilities.map(item => <View style={styles.pill} key={item}><Text style={styles.pillText}>{item}</Text></View>)}</View>

      <View style={styles.heroCard}>
        <View style={styles.cardLine} />
        <Text style={styles.cardKicker}>NEXTGEN IN ONE PLACE</Text>
        <Text style={styles.cardTitle}>Training. Consulting. Security.</Text>
        <Text style={styles.cardText}>Explore services, training engagements and connect for your requirement.</Text>
        <View style={styles.actions}>
          <Pressable style={styles.primary} onPress={() => router.push('/services')}><Text style={styles.primaryText}>VIEW SERVICES</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => router.push('/connect')}><Text style={styles.secondaryText}>LET'S CONNECT</Text></Pressable>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <Pressable style={styles.quick} onPress={() => router.push('/training')}><Text style={styles.quickNumber}>01</Text><Text style={styles.quickTitle}>Training Delivered</Text><Text style={styles.quickText}>Clients & engagements</Text></Pressable>
        <Pressable style={styles.quick} onPress={() => router.push('/about')}><Text style={styles.quickNumber}>02</Text><Text style={styles.quickTitle}>About Mukul</Text><Text style={styles.quickText}>Experience & expertise</Text></Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  brandMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#17204a', borderWidth: 1, borderColor: '#355177', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  brandMarkText: { color: '#67e8f9', fontSize: 18, fontWeight: '900' },
  brand: { color: '#eef2ff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  brandSub: { color: '#6f7da2', fontSize: 7.5, fontWeight: '800', letterSpacing: 1, marginTop: 3 },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: '#101936', borderColor: '#26365b', borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 16 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#67e8f9', marginRight: 7 },
  heroBadgeText: { color: '#9feaf5', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  headline: { color: '#f8fafc', fontSize: 50, lineHeight: 51, fontWeight: '900', letterSpacing: -1.8 },
  accent: { color: '#67dff2' },
  description: { color: '#b8c4df', fontSize: 15, lineHeight: 23, marginTop: 19 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 18 },
  pill: { borderColor: '#27345b', backgroundColor: '#0c102b', borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  pillText: { color: '#cbd5e1', fontWeight: '800', fontSize: 10.5 },
  heroCard: { position: 'relative', marginTop: 24, padding: 18, borderRadius: 21, backgroundColor: '#111633', borderWidth: 1, borderColor: '#303b67', overflow: 'hidden' },
  cardLine: { position: 'absolute', top: 0, left: 18, right: 18, height: 2, backgroundColor: '#2dd4bf', opacity: 0.9 },
  cardKicker: { color: '#67e8f9', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 },
  cardTitle: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 7 },
  cardText: { color: '#9eadd0', fontSize: 13, lineHeight: 20, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  primary: { flex: 1, backgroundColor: '#67e8f9', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#07111f', fontSize: 10.5, fontWeight: '900', letterSpacing: 0.3 },
  secondary: { flex: 1, borderColor: '#3b4775', backgroundColor: '#0d122d', borderWidth: 1, borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: '#dbeafe', fontSize: 10.5, fontWeight: '900' },
  quickGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quick: { flex: 1, backgroundColor: '#0d102c', borderWidth: 1, borderColor: '#252d55', borderRadius: 16, padding: 15 },
  quickNumber: { color: '#a78bfa', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  quickTitle: { color: '#e5e7eb', fontSize: 13, fontWeight: '900', marginTop: 6 },
  quickText: { color: '#7180a2', fontSize: 10.5, marginTop: 4 },
})
