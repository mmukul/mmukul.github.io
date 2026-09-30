import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'

export default function Connect() {
  return <Screen><SectionTitle kicker="LET'S CONNECT" title="Have a requirement?" text="Tell me briefly what you need. Secure enquiry submission will be connected in the next phase." />
    <View style={styles.card}>
      <TextInput placeholder="Name" placeholderTextColor="#7180a2" style={styles.input} />
      <TextInput placeholder="+91 10-digit mobile" placeholderTextColor="#7180a2" keyboardType="phone-pad" maxLength={10} style={styles.input} />
      <TextInput placeholder="Email" placeholderTextColor="#7180a2" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput placeholder="Requirement" placeholderTextColor="#7180a2" multiline style={[styles.input, styles.multiline]} />
      <Pressable style={styles.button} onPress={() => Alert.alert('Mobile app v0.2', 'The secure backend connection will be enabled in the next phase.') }><Text style={styles.buttonText}>SEND ENQUIRY</Text></Pressable>
    </View>
  </Screen>
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#121437', borderColor: '#292f5b', borderWidth: 1, borderRadius: 18, padding: 16 },
  input: { color: '#f8fafc', backgroundColor: '#0d0e29', borderColor: '#292d55', borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, marginBottom: 10 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  button: { backgroundColor: '#22d3ee', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 2 },
  buttonText: { color: '#07111f', fontWeight: '900', letterSpacing: 1 },
})
