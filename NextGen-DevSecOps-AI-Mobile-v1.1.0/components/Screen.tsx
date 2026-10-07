import { PropsWithChildren } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { theme } from '../theme'

export function Screen({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: Math.max(28, insets.bottom + 76) }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={Platform.OS !== 'android'}>
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />
        <View pointerEvents="none" style={styles.glowThree} />
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  )
}
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.colors.background}, screen:{flex:1,backgroundColor:theme.colors.background}, content:{flexGrow:1,paddingTop:3}, body:{width:'100%',maxWidth:640,alignSelf:'center',paddingHorizontal:14,paddingTop:8},
  glowOne:{position:'absolute',width:280,height:280,borderRadius:140,backgroundColor:'#2563EB',opacity:.15,top:-125,right:-105}, glowTwo:{position:'absolute',width:220,height:220,borderRadius:110,backgroundColor:'#06B6D4',opacity:.11,top:340,left:-125}, glowThree:{position:'absolute',width:190,height:190,borderRadius:95,backgroundColor:'#7C3AED',opacity:.11,top:800,right:-105}
})
