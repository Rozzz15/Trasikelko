import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { SafetyBadgeColor } from '../utils/safetyStorage';

interface SafetyBadgeProps {
  badgeColor: SafetyBadgeColor;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export const SafetyBadge: React.FC<SafetyBadgeProps> = ({
  badgeColor,
  size = 'medium',
  showLabel = true,
}) => {
  const badgeConfig = {
    green: {
      color: colors.success,
      label: 'Excellent',
      icon: 'shield-checkmark' as const,
    },
    yellow: {
      color: colors.warning,
      label: 'New Driver',
      icon: 'time' as const,
    },
    red: {
      color: colors.error,
      label: 'Caution',
      icon: 'warning' as const,
    },
  };

  const config = badgeConfig[badgeColor];
  const sizeConfig = {
    small: { size: 16, fontSize: 10, padding: 4 },
    medium: { size: 20, fontSize: 12, padding: 6 },
    large: { size: 24, fontSize: 14, padding: 8 },
  };

  const { size: iconSize, fontSize, padding } = sizeConfig[size];

  return (
    <View style={[styles.badge, { backgroundColor: config.color + '15' }]}>
      <View style={[styles.badgeDot, { backgroundColor: config.color }]} />
      <Ionicons name={config.icon} size={iconSize} color={config.color} />
      {showLabel && (
        <Text style={[styles.badgeLabel, { color: config.color, fontSize }]}>
          {config.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
});










