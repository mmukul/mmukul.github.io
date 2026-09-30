import { StyleSheet, Text, View } from 'react-native'

export function SectionTitle({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  kicker: { color: '#67e8f9', fontWeight: '900', letterSpacing: 2, fontSize: 11, marginBottom: 7 },
  title: { color: '#f8fafc', fontSize: 29, fontWeight: '900', lineHeight: 35 },
  text: { color: '#aab6d4', fontSize: 14, lineHeight: 21, marginTop: 8 },
})
