import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
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

