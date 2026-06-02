// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { COLORS } from "../../constants/agents";

interface TabIconProps {
  emoji: string;
  label: string;
  focused: boolean;
}

function TabIcon({ emoji, label, focused }: TabIconProps) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 4 }}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          color: focused ? COLORS.cyan : COLORS.subtext,
          marginTop: 2,
          fontWeight: focused ? "700" : "400",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0D1929",
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 68,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💭" label="Chat" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📊" label="Agentes" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="flowchart"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🔰" label="Fluxo" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
