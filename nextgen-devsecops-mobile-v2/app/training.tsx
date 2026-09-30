import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'

const clients = [
  ['B-to-B · Corporate', 'DevOps Induction Batch', 'Impressico • Wellar Group'],
  ['B-to-C · Consumer', 'DevOps Fresher Batch', 'Brilliant Infotech'],
  ['B-to-C · Consumer', 'DevSecOps Experienced Batch', 'Koeing Institute'],
]

export default function Training() {
  return <Screen><SectionTitle kicker="TRAINING DELIVERED" title="Clients & Training Engagements" text="Selected organizations and institutes where DevOps and DevSecOps training has been delivered." />
    {clients.map(([type, title, names]) => <View style={styles.card} key={title}><Text style={styles.type}>{type}</Text><Text style={styles.title}>{title}</Text><Text style={styles.names}>{names}</Text></View>)}
  </Screen>
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#121437', borderColor: '#292f5b', borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 12 },
  type: { color: '#a78bfa', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '900', marginTop: 8 },
  names: { color: '#9fb0cf', fontSize: 13, marginTop: 7 },
})
