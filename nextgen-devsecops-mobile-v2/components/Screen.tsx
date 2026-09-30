import { PropsWithChildren } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

export function Screen({ children }: PropsWithChildren) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08091f' },
  content: { padding: 18, paddingTop: 24, paddingBottom: 44 },
})
