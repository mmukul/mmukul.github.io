import { PropsWithChildren } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

export function Screen({ children }: PropsWithChildren) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.body}>{children}</View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07091c' },
  content: { paddingBottom: 46, minHeight: '100%' },
  body: { paddingHorizontal: 18, paddingTop: 22 },
  glowOne: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#16165a', opacity: 0.45, top: -100, right: -80 },
  glowTwo: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#063d52', opacity: 0.3, top: 360, left: -100 },
})
