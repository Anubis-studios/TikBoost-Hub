import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/theme';
import { useUser } from '@/hooks/useUser';

function NotificationBell() {
  const { unreadCount } = useUser();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/notifications')}
      style={bellStyles.btn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons name="notifications-none" size={24} color={Colors.textSecondary} />
      {unreadCount > 0 && (
        <View style={bellStyles.badge}>
          <Text style={bellStyles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const bellStyles = StyleSheet.create({
  btn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
});

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    height: Platform.select({
      ios: insets.bottom + 56,
      android: insets.bottom + 60,
      default: 66,
    }),
    paddingTop: 6,
    paddingBottom: Platform.select({
      ios: insets.bottom + 6,
      android: insets.bottom + 6,
      default: 8,
    }),
    paddingHorizontal: 4,
    backgroundColor: '#111111',
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earn"
        options={{
          title: 'Earn',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="star" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="boost"
        options={{
          title: 'Boost',
          tabBarIcon: ({ color, size }) => (
            <View style={{
              backgroundColor: color === Colors.primary ? Colors.primary : 'transparent',
              borderRadius: 999,
              width: 42,
              height: 42,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 4,
              borderWidth: color === Colors.primary ? 0 : 1,
              borderColor: Colors.surfaceBorder,
            }}>
              <MaterialIcons name="rocket-launch" size={20} color={color === Colors.primary ? '#fff' : color} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Top',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="emoji-events" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: 'Tools',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="auto-awesome" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
