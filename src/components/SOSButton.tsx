import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius, shadows, spacing } from '../theme';

interface SOSButtonProps {
  onPress: () => void;
  variant?: 'floating' | 'inline';
}

export const SOSButton: React.FC<SOSButtonProps> = ({
  onPress,
  variant = 'floating',
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, variant === 'floating' && styles.floating]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name="alert-circle" size={24} color={colors.white} />
      <Text style={styles.text}>SOS</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.sos,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
    ...shadows.large,
  },
  floating: {
    position: 'absolute',
    bottom: 100,
    right: spacing.md,
    zIndex: 1000,
  },
  text: {
    ...typography.button,
    color: colors.white,
  },
});





