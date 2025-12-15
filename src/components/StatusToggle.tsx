import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';
import { DriverStatus } from '../utils/driverLocationStorage';

interface StatusToggleProps {
  status: DriverStatus;
  onStatusChange: (status: DriverStatus) => void;
  disabled?: boolean;
  disabledMessage?: string;
  disableAvailable?: boolean; // Disable "Available" option when driver has active booking
}

export const StatusToggle: React.FC<StatusToggleProps> = ({
  status,
  onStatusChange,
  disabled = false,
  disabledMessage,
  disableAvailable = false,
}) => {
  const getStatusConfig = (statusType: DriverStatus) => {
    switch (statusType) {
      case 'available':
        return {
          label: 'Available',
          color: colors.success,
          icon: '✓',
        };
      case 'on_ride':
        return {
          label: 'On Ride',
          color: colors.warning,
          icon: '🚗',
        };
      case 'offline':
      default:
        return {
          label: 'Offline',
          color: colors.gray,
          icon: '○',
        };
    }
  };

  const handleStatusPress = (newStatus: DriverStatus) => {
    if (!disabled) {
      onStatusChange(newStatus);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Driver Status</Text>
      {disabled && disabledMessage && (
        <Text style={styles.disabledMessage}>{disabledMessage}</Text>
      )}
      <View style={styles.statusContainer}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'offline' && styles.statusButtonActive,
            { borderColor: status === 'offline' ? colors.gray : colors.border },
            disabled && styles.statusButtonDisabled,
          ]}
          onPress={() => handleStatusPress('offline')}
          activeOpacity={0.7}
          disabled={disabled || status === 'offline'}
        >
          <View style={[styles.statusIndicator, { backgroundColor: status === 'offline' ? colors.gray : colors.lightGray }]} />
          <Text style={[styles.statusText, status === 'offline' && styles.statusTextActive]}>
            Offline
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'available' && styles.statusButtonActive,
            { borderColor: status === 'available' ? colors.success : colors.border },
            (disabled || disableAvailable) && styles.statusButtonDisabled,
          ]}
          onPress={() => handleStatusPress('available')}
          activeOpacity={0.7}
          disabled={disabled || status === 'available' || disableAvailable}
        >
          <View style={[styles.statusIndicator, { backgroundColor: status === 'available' ? colors.success : colors.lightGray }]} />
          <Text style={[styles.statusText, status === 'available' && styles.statusTextActive]}>
            Available
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.statusButton,
            status === 'on_ride' && styles.statusButtonActive,
            { borderColor: status === 'on_ride' ? colors.warning : colors.border },
            disabled && styles.statusButtonDisabled,
            status === 'on_ride' && styles.statusButtonOnRide,
          ]}
          onPress={() => handleStatusPress('on_ride')}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <View style={[styles.statusIndicator, { backgroundColor: status === 'on_ride' ? colors.warning : colors.lightGray }]} />
          <Text style={[styles.statusText, status === 'on_ride' && styles.statusTextActive]}>
            On Ride
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.sm,
    color: colors.gray,
  },
  disabledMessage: {
    ...typography.caption,
    color: colors.warning,
    marginBottom: spacing.xs,
    fontSize: 11,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    gap: spacing.xs,
    ...colors.shadow ? {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    } : {},
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    gap: spacing.xs,
    minWidth: 100,
    justifyContent: 'center',
  },
  statusButtonActive: {
    // Active state styling is handled by borderColor
  },
  statusButtonOnRide: {
    backgroundColor: '#FFF8E1', // Light yellow/orange background for on_ride
  },
  statusButtonDisabled: {
    opacity: 0.5,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    ...typography.bodyBold,
    fontSize: 12,
    color: colors.gray,
  },
  statusTextActive: {
    color: colors.darkText,
  },
});
