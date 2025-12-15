import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportIssueToBarangay } from '../utils/barangayStorage';
import { reportComplaint } from '../utils/safetyStorage';
import * as Location from 'expo-location';

interface ReportIssueScreenProps {
  navigation: any;
  route?: {
    params?: {
      driverEmail?: string;
      driverName?: string;
      tripId?: string;
    };
  };
}

export const ReportIssueScreen: React.FC<ReportIssueScreenProps> = ({ navigation, route }) => {
  const [issueType, setIssueType] = useState<'driver_complaint' | 'safety_concern' | 'overcharging' | 'general' | 'other'>('general');
  const [complaintType, setComplaintType] = useState<'overcharging' | 'rude_behavior' | 'unsafe_driving' | 'vehicle_condition' | 'other'>('other');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const driverEmail = route?.params?.driverEmail;
  const driverName = route?.params?.driverName;
  const tripId = route?.params?.tripId;

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Information', 'Please provide a description of the issue');
      return;
    }

    setIsSubmitting(true);

    try {
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (!currentUserEmail) {
        Alert.alert('Error', 'Please login to report an issue');
        return;
      }

      const userAccount = await import('../utils/userStorage').then(m => m.getUserAccount(currentUserEmail));
      const userName = userAccount?.fullName || 'Anonymous';

      // Get user location if available
      let coordinates: { latitude: number; longitude: number } | undefined;
      try {
        // Check if location services are enabled
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (servicesEnabled) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            coordinates = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
          }
        }
      } catch (error: any) {
        console.error('Error getting location:', error);
        // Silently fail - location is optional for reporting issues
      }

      // Report to barangay
      await reportIssueToBarangay({
        reportedBy: currentUserEmail,
        reportedByName: userName,
        driverEmail,
        driverName,
        type: issueType,
        description: description.trim(),
        location: location || undefined,
        coordinates,
      });

      // If it's a driver complaint, also report to safety system
      if (driverEmail && (issueType === 'driver_complaint' || issueType === 'overcharging')) {
        await reportComplaint({
          driverEmail,
          date: new Date().toISOString(),
          type: issueType === 'overcharging' ? 'overcharging' : complaintType,
          description: description.trim(),
          reportedBy: currentUserEmail,
          tripId,
        });
      }

      Alert.alert(
        'Issue Reported',
        'Your report has been submitted to the barangay. Thank you for helping keep our community safe.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error reporting issue:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.darkText} />
          </TouchableOpacity>
          <Text style={styles.title}>Report Issue</Text>
          <View style={styles.placeholder} />
        </View>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="alert-circle" size={24} color={colors.primary} />
            <Text style={styles.cardTitle}>Report to Barangay</Text>
          </View>
          <Text style={styles.cardDescription}>
            Report issues, complaints, or safety concerns directly to the barangay hall.
            Your report will be reviewed and appropriate action will be taken.
          </Text>
        </Card>

        {driverEmail && (
          <Card style={styles.card}>
            <View style={styles.driverInfo}>
              <Ionicons name="person" size={20} color={colors.gray} />
              <Text style={styles.driverInfoText}>
                Reporting about: {driverName || 'Driver'}
              </Text>
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.label}>Issue Type</Text>
          <View style={styles.typeContainer}>
            {[
              { key: 'driver_complaint', label: 'Driver Complaint', icon: 'person' },
              { key: 'safety_concern', label: 'Safety Concern', icon: 'shield' },
              { key: 'overcharging', label: 'Overcharging', icon: 'cash' },
              { key: 'general', label: 'General Issue', icon: 'information-circle' },
              { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
            ].map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.typeButton,
                  issueType === type.key && styles.typeButtonActive,
                ]}
                onPress={() => setIssueType(type.key as any)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={20}
                  color={issueType === type.key ? colors.white : colors.gray}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    issueType === type.key && styles.typeButtonTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {issueType === 'driver_complaint' && (
          <Card style={styles.card}>
            <Text style={styles.label}>Complaint Type</Text>
            <View style={styles.complaintContainer}>
              {[
                { key: 'overcharging', label: 'Overcharging' },
                { key: 'rude_behavior', label: 'Rude Behavior' },
                { key: 'unsafe_driving', label: 'Unsafe Driving' },
                { key: 'vehicle_condition', label: 'Vehicle Condition' },
                { key: 'other', label: 'Other' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.complaintButton,
                    complaintType === type.key && styles.complaintButtonActive,
                  ]}
                  onPress={() => setComplaintType(type.key as any)}
                >
                  <Text
                    style={[
                      styles.complaintButtonText,
                      complaintType === type.key && styles.complaintButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        <Card style={styles.card}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Please describe the issue in detail..."
            placeholderTextColor={colors.gray}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.label}>Location (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Where did this happen?"
            placeholderTextColor={colors.gray}
            value={location}
            onChangeText={setLocation}
          />
        </Card>

        <Button
          title="Submit Report"
          onPress={handleSubmit}
          variant="primary"
          disabled={isSubmitting || !description.trim()}
          style={styles.submitButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h1,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
  },
  cardDescription: {
    ...typography.body,
    color: colors.gray,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverInfoText: {
    ...typography.body,
  },
  label: {
    ...typography.bodyBold,
    marginBottom: spacing.md,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.xs,
    minWidth: '45%',
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    ...typography.body,
    color: colors.gray,
  },
  typeButtonTextActive: {
    color: colors.white,
  },
  complaintContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  complaintButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  complaintButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  complaintButtonText: {
    ...typography.body,
    color: colors.gray,
  },
  complaintButtonTextActive: {
    color: colors.white,
  },
  textArea: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 120,
    backgroundColor: colors.white,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  submitButton: {
    marginTop: spacing.md,
  },
});



