import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: '#080B14' },
      headerTintColor: '#FFFFFF',
      tabBarStyle: { backgroundColor: '#0D1220', borderTopColor: '#252F49' },
      tabBarActiveTintColor: '#6FE7FF',
      tabBarInactiveTintColor: '#7D879D'
    }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
      <Tabs.Screen name="recordings" options={{ title: 'Recordings' }} />
      <Tabs.Screen name="cloud-lab" options={{ title: 'Cloud Lab' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
