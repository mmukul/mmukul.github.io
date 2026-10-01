import { StyleSheet, Text, View } from 'react-native'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'

const clients = [
  ['B-to-B · Corporate', 'DevOps Induction Batch', ['Impressico', 'Wellar Group']],
  ['B-to-C · Consumer', 'DevOps Fresher Batch', ['Brilliant Infotech']],
  ['B-to-C · Consumer', 'DevSecOps Experienced Batch', ['Koeing Institute']],
]

export default function Training() {
  return <Screen><SectionTitle kicker="TRAINING DELIVERED" title="Clients & Training Engagements" text="Selected organizations and institutes where DevOps and DevSecOps training has been delivered across corporate and consumer learning programs." />
    {clients.map(([type, title, names]) => <View style={styles.card} key={title}><Text style={styles.type}>{type}</Text><Text style={styles.title}>{title}</Text><View style={styles.names}>{(names as string[]).map(name => <View style={styles.nameRow} key={name}><View style={styles.dot} /><Text style={styles.name}>{name}</Text></View>)}</View></View>)}
  </Screen>
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111633', borderColor: '#292f5b', borderWidth: 1, borderRadius: 18, padding: 17, marginBottom: 11 },
  type: { color: '#a78bfa', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '900', marginTop: 8 },
  names: { marginTop: 9 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#67e8f9', marginRight: 8 },
  name: { color: '#aab6d4', fontSize: 13 },
})
