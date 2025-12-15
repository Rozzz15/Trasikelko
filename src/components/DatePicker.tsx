import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';

interface DatePickerProps {
  label?: string;
  value?: string;
  onDateSelected: (date: string) => void;
  error?: string;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onDateSelected,
  error,
  placeholder = 'Select date',
  maximumDate,
  minimumDate,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  // Parse date from string format MM/DD/YYYY
  const parseDate = (dateString?: string): Date => {
    if (!dateString) return new Date();
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]) - 1; // Month is 0-indexed
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      return new Date(year, month, day);
    }
    return new Date();
  };

  const [selectedDate, setSelectedDate] = useState<Date>(
    value ? parseDate(value) : new Date()
  );

  // Update selectedDate when value prop changes
  React.useEffect(() => {
    if (value) {
      setSelectedDate(parseDate(value));
    }
  }, [value]);

  const formatDate = (date: Date): string => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
  };

  const handleConfirm = () => {
    const formattedDate = formatDate(selectedDate);
    onDateSelected(formattedDate);
    setShowPicker(false);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  };

  const handleYearChange = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(selectedDate.getFullYear() + delta);
    if (minimumDate && newDate < minimumDate) {
      setSelectedDate(minimumDate);
    } else if (maximumDate && newDate > maximumDate) {
      setSelectedDate(maximumDate);
    } else {
      setSelectedDate(newDate);
    }
  };

  const handleMonthChange = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + delta);
    if (minimumDate && newDate < minimumDate) {
      setSelectedDate(minimumDate);
    } else if (maximumDate && newDate > maximumDate) {
      setSelectedDate(maximumDate);
    } else {
      setSelectedDate(newDate);
    }
  };

  const handleDayChange = (day: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(day);
    if (minimumDate && newDate < minimumDate) {
      return;
    }
    if (maximumDate && newDate > maximumDate) {
      return;
    }
    setSelectedDate(newDate);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.inputContainer, error && styles.inputError]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <View style={styles.inputContent}>
          <Ionicons name="calendar-outline" size={20} color={colors.gray} style={styles.icon} />
          <Text style={[styles.inputText, !value && styles.placeholder]}>
            {value || placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.gray} />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={styles.confirmButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerContainer}>
              {/* Year Selector */}
              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Year:</Text>
                <View style={styles.selectorControls}>
                  <TouchableOpacity
                    onPress={() => handleYearChange(-1)}
                    disabled={minimumDate && selectedDate.getFullYear() <= minimumDate.getFullYear()}
                    style={[styles.selectorButton, (minimumDate && selectedDate.getFullYear() <= minimumDate.getFullYear()) && styles.selectorButtonDisabled]}
                  >
                    <Ionicons name="chevron-back" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.selectorValue}>{selectedDate.getFullYear()}</Text>
                  <TouchableOpacity
                    onPress={() => handleYearChange(1)}
                    disabled={maximumDate && selectedDate.getFullYear() >= maximumDate.getFullYear()}
                    style={[styles.selectorButton, (maximumDate && selectedDate.getFullYear() >= maximumDate.getFullYear()) && styles.selectorButtonDisabled]}
                  >
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Month Selector */}
              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Month:</Text>
                <View style={styles.selectorControls}>
                  <TouchableOpacity
                    onPress={() => handleMonthChange(-1)}
                    style={styles.selectorButton}
                  >
                    <Ionicons name="chevron-back" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.selectorValue}>{getMonthName(selectedDate.getMonth())}</Text>
                  <TouchableOpacity
                    onPress={() => handleMonthChange(1)}
                    style={styles.selectorButton}
                  >
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Day Selector */}
              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Day:</Text>
                <View style={styles.dayGrid}>
                  {Array.from({ length: getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth()) }, (_, i) => i + 1).map((day) => (
                    <TouchableOpacity
                      key={day}
                      onPress={() => handleDayChange(day)}
                      style={[
                        styles.dayButton,
                        selectedDate.getDate() === day && styles.dayButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          selectedDate.getDate() === day && styles.dayButtonTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyBold,
    marginBottom: spacing.sm,
    color: colors.darkText,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: spacing.sm,
  },
  inputText: {
    ...typography.body,
    flex: 1,
    color: colors.darkText,
  },
  placeholder: {
    color: colors.gray,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  cancelButton: {
    ...typography.body,
    color: colors.gray,
  },
  confirmButton: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  pickerContainer: {
    maxHeight: 400,
    padding: spacing.md,
  },
  selectorRow: {
    marginBottom: spacing.lg,
  },
  selectorLabel: {
    ...typography.bodyBold,
    marginBottom: spacing.sm,
    color: colors.darkText,
  },
  selectorControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  selectorButton: {
    padding: spacing.sm,
  },
  selectorButtonDisabled: {
    opacity: 0.3,
  },
  selectorValue: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: colors.primary,
  },
  dayButtonText: {
    ...typography.body,
    color: colors.darkText,
  },
  dayButtonTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
});

