import { Tabs } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { theme } from '../theme'

const icons: Record<string, string> = { Home: '⌂', Courses: '▣', "Let's Connect": '✦' }

export default function Layout() {
  return <>
    <StatusBar style="light" />
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: theme.colors.accent,
      tabBarInactiveTintColor: '#8FA7C8',
      tabBarLabelStyle: styles.label,
      tabBarItemStyle: styles.item,
      tabBarIcon: ({ focused }) => (
        <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
          <Text style={[styles.icon, focused && styles.iconActive]}>{icons[String(route.name)] || '•'}</Text>
        </View>
      ),
    })}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="training" options={{ title: 'Courses' }} />
      <Tabs.Screen name="connect" options={{ title: "Let's Connect" }} />
      <Tabs.Screen name="student-login" options={{ href: null }} />
      <Tabs.Screen name="payment" options={{ href: null }} />
      <Tabs.Screen name="services" options={{ href: null }} />
      <Tabs.Screen name="about" options={{ href: null }} />
      <Tabs.Screen name="youtube" options={{ href: null }} />
    </Tabs>
  </>
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute', left: 8, right: 8, bottom: Platform.OS === 'ios' ? 8 : 7,
    height: 68, paddingTop: 5, paddingBottom: 6, paddingHorizontal: 5,
    borderTopWidth: 1, borderTopColor: 'rgba(103,232,249,.22)', borderRadius: 22,
    backgroundColor: '#0B1020', elevation: 16, shadowColor: '#000', shadowOpacity: .38,
    shadowRadius: 16, shadowOffset: { width: 0, height: 7 },
  },
  item: { minHeight: 56, marginHorizontal: 2, marginVertical: 1, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', justifyContent: 'center' },
  label: { fontSize: 8.5, fontWeight: '900', marginTop: 2, letterSpacing: .15 },
  iconBox: { width: 34, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(21,21,47,.82)', borderWidth: 1, borderColor: 'rgba(148,163,184,.16)' },
  iconBoxActive: { backgroundColor: '#15152F', borderColor: '#67E8F9', shadowColor: '#67E8F9', shadowOpacity: .28, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
  icon: { fontSize: 16, color: '#8FA1B8', fontWeight: '900' },
  iconActive: { color: '#67E8F9' },
})
