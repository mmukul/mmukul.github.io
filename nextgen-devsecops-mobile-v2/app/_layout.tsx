import { Tabs } from 'expo-router'

export default function Layout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0d0e2b', borderTopColor: '#252653', height: 62, paddingTop: 6, paddingBottom: 6 },
      tabBarActiveTintColor: '#67e8f9',
      tabBarInactiveTintColor: '#7f8aaa',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '800' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="training" options={{ title: 'Training' }} />
      <Tabs.Screen name="about" options={{ title: 'About' }} />
      <Tabs.Screen name="connect" options={{ title: 'Connect' }} />
    </Tabs>
  )
}
