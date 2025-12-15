import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, shadows, borderRadius } from '../theme';

interface Tab {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
}

interface BottomNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabPress: (tabName: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  tabs,
  activeTab,
  onTabPress,
}) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        const iconName = isActive && tab.activeIcon ? tab.activeIcon : tab.icon;

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={20}
              color={isActive ? colors.buttonPrimary : colors.gray}
            />
            <Text
              style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    ...shadows.small,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs - 2,
    borderRadius: borderRadius.sm,
    marginHorizontal: 2,
  },
  tabActive: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    marginBottom: 2,
  },
  iconContainerActive: {
    backgroundColor: 'transparent',
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.gray,
    fontWeight: '500',
    marginTop: 1,
  },
  tabLabelActive: {
    color: colors.buttonPrimary,
    fontWeight: '600',
  },
});





