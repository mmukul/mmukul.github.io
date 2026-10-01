import { Tabs } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0b0d25',
            borderTopColor: '#242950',
            borderTopWidth: 1,
            height: 68,
            paddingTop: 7,
            paddingBottom: 8,
          },
          tabBarActiveTintColor: '#67e8f9',
          tabBarInactiveTintColor: '#7f8aaa',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '800' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="services" options={{ title: 'Services' }} />
        <Tabs.Screen name="training" options={{ title: 'Training' }} />
        <Tabs.Screen name="about" options={{ title: 'About' }} />
        <Tabs.Screen name="connect" options={{ title: 'Connect' }} />
      </Tabs>
    </>
  )
}
