import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Linking,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Button, Card } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SOSScreenProps {
  onBack: () => void;
}

export const SOSScreen: React.FC<SOSScreenProps> = ({ onBack }) => {
  const [shareLocation, setShareLocation] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get user location when component mounts
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    };
    getLocation();
  }, []);

  // Countdown timer for SOS activation
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      activateSOS();
    }
  }, [countdown]);

  const makePhoneCall = (phoneNumber: string) => {
    // Remove all non-digit characters except + for international numbers
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    // Determine the best URL scheme for the platform
    const phoneUrl = Platform.select({
      ios: `telprompt:${cleanNumber}`, // iOS - shows confirmation prompt
      android: `tel:${cleanNumber}`,   // Android - opens dialer
      default: `tel:${cleanNumber}`,
    });
    
    // Try to open the phone dialer directly
    // Note: In Expo Go, phone calls may not work. You may need a development build.
    Linking.openURL(phoneUrl)
      .then(() => {
        // Success - phone dialer should open
        console.log('Phone dialer opened successfully');
      })
      .catch((error) => {
        console.error('Error opening phone dialer:', error);
        
        // Show fallback message with the number
        Alert.alert(
          'Unable to Open Phone Dialer',
          `Please dial this number manually:\n\n${cleanNumber}\n\nNote: If you're using Expo Go, phone calls require a development build.`,
          [{ text: 'OK' }]
        );
      });
  };

  const sendLocationSMS = async (phoneNumber: string) => {
    if (!userLocation) return;

    const locationUrl = `https://www.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}`;
    const message = `EMERGENCY SOS! I need help immediately. My location: ${locationUrl}`;
    const smsUrl = Platform.select({
      ios: `sms:${phoneNumber}&body=${encodeURIComponent(message)}`,
      android: `sms:${phoneNumber}?body=${encodeURIComponent(message)}`,
    });

    if (smsUrl) {
      Linking.canOpenURL(smsUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(smsUrl);
          } else {
            Alert.alert('Error', 'SMS is not supported on this device');
          }
        })
        .catch((error) => {
          console.error('Error sending SMS:', error);
        });
    }
  };

  const activateSOS = async () => {
    setIsActivated(true);
    setCountdown(null);
    
    // Vibrate device
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 500, 200, 500], true);
    } else {
      Vibration.vibrate([0, 500, 200, 500]);
    }

    // Get emergency contacts from storage
    try {
      const emergencyContactsJson = await AsyncStorage.getItem('emergency_contacts');
      const storedContacts = emergencyContactsJson ? JSON.parse(emergencyContactsJson) : [];
      
      // Import barangay tanod contacts
      const { getBarangayTanodContacts } = require('../utils/barangayStorage');
      const barangayTanodContacts = await getBarangayTanodContacts();
      
      // Call primary emergency number (MDRRMO Lopez)
      makePhoneCall('09177074316');

      // Send location to emergency contacts if sharing is enabled
      if (shareLocation && userLocation) {
        // Send to all Lopez emergency contacts
        const lopezContacts = [
          '09177074316', // MDRRMO Lopez - Primary
          '09093410636', // MDRRMO Lopez - Secondary
          '09985985758', // PNP Lopez
          '09303271448', // BFP Lopez
          '09708283554', // RHU Lopez
        ];
        
        // Send to stored emergency contacts (if any)
        storedContacts.forEach((contact: { number: string }) => {
          if (contact.number) {
            sendLocationSMS(contact.number);
          }
        });
        
        // Send to all Lopez emergency contacts
        lopezContacts.forEach((number) => {
          sendLocationSMS(number);
        });
        
        // Send to barangay tanods
        barangayTanodContacts.forEach((number: string) => {
          sendLocationSMS(number);
        });
      }

      Alert.alert(
        'SOS ACTIVATED',
        'Emergency services have been contacted. Your location has been shared. Help is on the way!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error activating SOS:', error);
      Alert.alert(
        'SOS ACTIVATED',
        'Emergency services have been contacted. Help is on the way!',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSOSActivation = () => {
    if (isActivated) {
      // Deactivate SOS
      if (Platform.OS === 'android') {
        Vibration.cancel();
      }
      Alert.alert(
        'SOS Deactivated',
        'Emergency assistance has been cancelled',
        [
          {
            text: 'OK',
            onPress: () => setIsActivated(false),
          },
        ]
      );
      setIsActivated(false);
    } else {
      // Start countdown before activation
      Alert.alert(
        'Activate Emergency SOS?',
        'This will immediately call emergency services (911). Press OK to activate in 3 seconds.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Activate',
            style: 'destructive',
            onPress: () => {
              setCountdown(3);
            },
          },
        ]
      );
    }
  };

  const [emergencyContacts, setEmergencyContacts] = useState([
    { name: 'MDRRMO Lopez', number: '09177074316', icon: 'warning' as const, description: '0917-707-4316 / 0909-341-0636 / (042) 717-4364', primaryNumber: '09177074316' },
    { name: 'PNP Lopez', number: '09985985758', icon: 'shield' as const, description: '0998-598-5758' },
    { name: 'BFP Lopez', number: '09303271448', icon: 'flame' as const, description: '0930-327-1448' },
    { name: 'RHU Lopez', number: '09708283554', icon: 'medical' as const, description: '0970-828-3554' },
  ]);

  // Load barangay tanod contacts
  useEffect(() => {
    const loadBarangayTanods = async () => {
      try {
        const { getBarangayTanodContacts } = require('../utils/barangayStorage');
        const tanodContacts = await getBarangayTanodContacts();
        if (tanodContacts.length > 0) {
          const tanodContactItems = tanodContacts.map((number: string, index: number) => ({
            name: `Barangay Tanod ${index + 1}`,
            number,
            icon: 'people' as const,
            description: number,
          }));
          setEmergencyContacts(prev => [...prev, ...tanodContactItems]);
        }
      } catch (error) {
        console.error('Error loading barangay tanod contacts:', error);
      }
    };
    loadBarangayTanods();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.darkText} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.subtitle}>
            Get immediate assistance in case of emergency
          </Text>
        </View>

        {/* Main SOS Button */}
        <View style={styles.sosButtonContainer}>
          <TouchableOpacity
            style={[
              styles.sosButton,
              isActivated && styles.sosButtonActive,
            ]}
            onPress={handleSOSActivation}
            activeOpacity={0.8}
            disabled={countdown !== null}
          >
            <Ionicons
              name="alert-circle"
              size={64}
              color={colors.white}
            />
            <Text style={styles.sosButtonText}>
              {countdown !== null
                ? `ACTIVATING IN ${countdown}...`
                : isActivated
                ? 'SOS ACTIVATED'
                : 'PRESS FOR SOS'}
            </Text>
            {countdown !== null && (
              <View style={styles.countdownOverlay}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={styles.infoTitle}>How it works</Text>
          </View>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <View style={styles.infoBullet} />
              <Text style={styles.infoText}>
                Press the SOS button to immediately notify emergency services
              </Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoBullet} />
              <Text style={styles.infoText}>
                Your location will be shared with emergency responders
              </Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoBullet} />
              <Text style={styles.infoText}>
                Emergency contacts will be notified automatically
              </Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoBullet} />
              <Text style={styles.infoText}>
                Stay on the line until help arrives
              </Text>
            </View>
          </View>
        </Card>

        {/* Share Location Toggle */}
        <Card style={styles.settingsCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="location" size={24} color={colors.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Share Live Location</Text>
                <Text style={styles.settingDescription}>
                  Allow emergency services to track your location
                </Text>
              </View>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: colors.lightGray, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </Card>

        {/* Emergency Contacts */}
        <View style={styles.contactsSection}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          {emergencyContacts.map((contact, index) => (
            <TouchableOpacity
              key={index}
              style={styles.contactItem}
              onPress={() => {
                const displayNumber = contact.description || contact.number;
                const numberToCall = (contact as any).primaryNumber || contact.number;
                
                Alert.alert(
                  'Call Emergency Service',
                  `Call ${contact.name}?\n${displayNumber}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Call',
                      style: 'default',
                      onPress: () => {
                        // Immediately open phone dialer
                        makePhoneCall(numberToCall);
                      },
                    },
                  ]
                );
              }}
            >
              <View style={styles.contactIcon}>
                <Ionicons name={contact.icon} size={24} color={colors.white} />
              </View>
              <View style={styles.contactContent}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactNumber}>{contact.description || contact.number}</Text>
              </View>
              <Ionicons name="call" size={24} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety Tips */}
        <Card style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="shield-checkmark" size={24} color={colors.success} />
            <Text style={styles.tipsTitle}>Safety Tips</Text>
          </View>
          <View style={styles.tipsList}>
            <Text style={styles.tipText}>
              • Always verify driver details before boarding
            </Text>
            <Text style={styles.tipText}>
              • Share your trip details with trusted contacts
            </Text>
            <Text style={styles.tipText}>
              • Trust your instincts and cancel if uncomfortable
            </Text>
            <Text style={styles.tipText}>
              • Keep emergency contacts updated
            </Text>
          </View>
        </Card>
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
    flexGrow: 1,
    padding: spacing.lg,
  },
  backButton: {
    padding: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
  },
  sosButtonContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.sos,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.large,
  },
  sosButtonActive: {
    backgroundColor: colors.success,
  },
  sosButtonText: {
    ...typography.h3,
    color: colors.white,
    marginTop: spacing.md,
    fontWeight: '700',
  },
  infoCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoTitle: {
    ...typography.h3,
    color: colors.darkText,
  },
  infoList: {
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  infoText: {
    ...typography.body,
    flex: 1,
    color: colors.darkText,
  },
  settingsCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.gray,
  },
  contactsSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactContent: {
    flex: 1,
  },
  contactName: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  contactNumber: {
    ...typography.caption,
    color: colors.gray,
  },
  tipsCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tipsTitle: {
    ...typography.h3,
    color: colors.darkText,
  },
  tipsList: {
    gap: spacing.sm,
  },
  tipText: {
    ...typography.body,
    color: colors.darkText,
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 100,
  },
  countdownText: {
    ...typography.h1,
    fontSize: 72,
    color: colors.white,
    fontWeight: '900',
  },
});





