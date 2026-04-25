import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { LayoutDashboard, MapPin, Mountain, Heart, ShoppingBag } from "lucide-react-native";

function TabIcon({ Icon, label, focused }: { Icon: React.ElementType; label: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Icon size={22} color={focused ? "#09090B" : "#A1A1AA"} strokeWidth={focused ? 2.5 : 1.5} />
      <Text style={{ fontSize: 10, color: focused ? "#09090B" : "#A1A1AA", fontWeight: focused ? "600" : "400" }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#F4F4F5",
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={LayoutDashboard} label="Dashboard" focused={focused} /> }}
      />
      <Tabs.Screen
        name="races"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={MapPin} label="Courses" focused={focused} /> }}
      />
      <Tabs.Screen
        name="trail"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={Mountain} label="Trail" focused={focused} /> }}
      />
      <Tabs.Screen
        name="health"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={Heart} label="Santé" focused={focused} /> }}
      />
      <Tabs.Screen
        name="shop"
        options={{ tabBarIcon: ({ focused }) => <TabIcon Icon={ShoppingBag} label="Boutique" focused={focused} /> }}
      />
    </Tabs>
  );
}
