import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { theme } from '../theme'

export function SectionTitle({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  const { width } = useWindowDimensions()
  const compact = width < 370
  return (
    <View style={styles.wrap}>
      <View style={styles.kickerRow}><View style={styles.kickerDot} /><Text style={styles.kicker}>{kicker}</Text></View>
      <Text allowFontScaling={false} style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 11 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent, marginRight: 8 },
  kicker: { color: theme.colors.accent, fontWeight: '900', letterSpacing: 1.6, fontSize: 9.5, flexShrink: 1 },
  title: { color: theme.colors.text, fontSize: 27, fontWeight: '900', lineHeight: 33, letterSpacing: -0.5, flexShrink: 1 }, titleCompact:{fontSize:24,lineHeight:29},
  text: { color: theme.colors.muted, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
})
