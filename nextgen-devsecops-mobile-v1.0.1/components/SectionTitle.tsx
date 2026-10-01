import { StyleSheet, Text, View } from 'react-native'

export function SectionTitle({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.kickerRow}><View style={styles.kickerDot} /><Text style={styles.kicker}>{kicker}</Text></View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#67e8f9', marginRight: 8 },
  kicker: { color: '#67e8f9', fontWeight: '900', letterSpacing: 1.9, fontSize: 10 },
  title: { color: '#f8fafc', fontSize: 29, fontWeight: '900', lineHeight: 35, letterSpacing: -0.6 },
  text: { color: '#aab6d4', fontSize: 14, lineHeight: 21, marginTop: 9 },
})
