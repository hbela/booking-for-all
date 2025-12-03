import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="voice-agent"
        options={{
          title: 'Voice Agent',
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}

