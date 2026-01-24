import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// AsyncStorage removed - using Supabase only
import { Button, Input, ImagePicker, Card } from '../components';
import {
  colors,
  typography,
  spacing,
  borderRadius,
} from '../theme';
import { Ionicons } from '@expo/vector-icons';
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validateLicenseNumber,
  validatePlateNumber,
} from '../utils/validation';
import { registerUser } from '../services/authService';
import { uploadProfilePhoto, uploadDriverLicense, uploadORCR } from '../services/storageService';
import { updateDriverData } from '../services/authService';
import { supabase } from '../config/supabase';

interface CreateAccountDriverScreenProps {
  onSubmit: (data: DriverFormData) => void;
  onBack: () => void;
}

export interface DriverFormData {
  // Personal Information
  fullName: string;
  phoneNumber: string;
  email: string;
  password: string;
  profilePhoto?: string;
  address: string;
  
  // Driver Identification
  driversLicenseNumber: string;
  licenseExpiryDate: string;
  licenseFrontPhoto?: string;
  licenseBackPhoto?: string;
  
  // Vehicle Information
  plateNumber: string;
  orcrPhoto?: string;
  vehicleModel: string;
  vehicleColor: string;
  franchiseNumber?: string;
}

export const CreateAccountDriverScreen: React.FC<CreateAccountDriverScreenProps> = ({
  onSubmit,
  onBack,
}) => {
  const [formData, setFormData] = useState<DriverFormData>({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    profilePhoto: undefined,
    address: '',
    driversLicenseNumber: '',
    licenseExpiryDate: '',
    licenseFrontPhoto: undefined,
    licenseBackPhoto: undefined,
    plateNumber: '',
    orcrPhoto: undefined,
    vehicleModel: '',
    vehicleColor: '',
    franchiseNumber: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DriverFormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof DriverFormData, string>> = {};

    // Personal Information
    if (!validateRequired(formData.fullName) || formData.fullName.length < 2) {
      newErrors.fullName = 'Please enter your full name';
    }
    if (!validatePhone(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid Philippine phone number';
    }
    if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!validateRequired(formData.password) || formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!validateRequired(formData.address)) {
      newErrors.address = 'Please enter your address';
    }

    // Driver Identification
    if (!validateLicenseNumber(formData.driversLicenseNumber)) {
      newErrors.driversLicenseNumber = 'Please enter a valid license number';
    }
    if (!validateRequired(formData.licenseExpiryDate)) {
      newErrors.licenseExpiryDate = 'Please enter license expiry date';
    }
    if (!formData.licenseFrontPhoto) {
      newErrors.licenseFrontPhoto = 'Please upload license front photo';
    }
    if (!formData.licenseBackPhoto) {
      newErrors.licenseBackPhoto = 'Please upload license back photo';
    }

    // Vehicle Information
    if (!validatePlateNumber(formData.plateNumber)) {
      newErrors.plateNumber = 'Please enter a valid plate number';
    }
    if (!formData.orcrPhoto) {
      newErrors.orcrPhoto = 'Please upload OR/CR photo';
    }
    if (!validateRequired(formData.vehicleModel)) {
      newErrors.vehicleModel = 'Please enter vehicle model/brand';
    }
    if (!validateRequired(formData.vehicleColor)) {
      newErrors.vehicleColor = 'Please enter vehicle color';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      try {
        Alert.alert('Submitting Application', 'Please wait while we process your driver application...');

        // 1. Register user with Supabase Auth
        const result = await registerUser(
          formData.email.toLowerCase(),
          formData.password,
          formData.fullName,
          formData.phoneNumber,
          'driver'
        );

        if (!result.success) {
          Alert.alert('Registration Failed', result.error || 'Failed to create account. Please try again.');
          return;
        }

        const userId = result.userId!;

        // 2. Upload images to Supabase Storage
        let profileUrl: string | undefined;
        let licenseFrontUrl: string | undefined;
        let licenseBackUrl: string | undefined;
        let orcrUrl: string | undefined;

        console.log('📸 Uploading driver documents...');
        
        if (formData.profilePhoto) {
          console.log('📸 [STEP 1] Uploading driver profile photo...');
          console.log('📸 [STEP 1] formData.profilePhoto:', formData.profilePhoto);
          const result = await uploadProfilePhoto(userId, formData.profilePhoto);
          console.log('📸 [STEP 1] Upload result:', JSON.stringify(result, null, 2));
          
          if (result.success && result.url) {
            profileUrl = result.url;
            console.log('✅ [STEP 1] Driver profile photo uploaded successfully');
            console.log('✅ [STEP 1] profileUrl variable set to:', profileUrl);
          } else {
            console.error('❌ [STEP 1] Failed to upload profile photo:', result.error);
            Alert.alert(
              'Upload Warning', 
              `Profile photo upload failed: ${result.error}\n\nYou can update it later from your profile.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          console.log('⚠️ [STEP 1] No profile photo selected by user');
          // Don't show alert - profile photo is optional
        }

        if (formData.licenseFrontPhoto) {
          const result = await uploadDriverLicense(userId, formData.licenseFrontPhoto, 'front');
          if (result.success) {
            licenseFrontUrl = result.url;
          } else {
            console.error('❌ Failed to upload license front:', result.error);
          }
        }

        if (formData.licenseBackPhoto) {
          const result = await uploadDriverLicense(userId, formData.licenseBackPhoto, 'back');
          if (result.success) {
            licenseBackUrl = result.url;
          } else {
            console.error('❌ Failed to upload license back:', result.error);
          }
        }

        if (formData.orcrPhoto) {
          const result = await uploadORCR(userId, formData.orcrPhoto);
          if (result.success) {
            orcrUrl = result.url;
          } else {
            console.error('❌ Failed to upload ORCR:', result.error);
          }
        }

        console.log('📸 [STEP 2] Upload results:', { profileUrl, licenseFrontUrl, licenseBackUrl, orcrUrl });
        console.log('📸 [STEP 2] Profile photo status:');
        console.log('  - formData.profilePhoto:', formData.profilePhoto);
        console.log('  - profileUrl variable:', profileUrl);
        console.log('  - profileUrl type:', typeof profileUrl);
        console.log('  - profileUrl truthiness:', !!profileUrl);
        console.log('  - Will save to DB:', !!profileUrl);

        // 3. Update user profile with profile photo
        console.log('📸 [STEP 3] Checking if profileUrl exists for database save...');
        if (profileUrl) {
          console.log('📸 [STEP 3] YES - profileUrl exists, proceeding with database save');
          console.log('💾 Saving driver profile photo URL to database...');
          console.log('💾 User ID:', userId);
          console.log('💾 URL to save:', profileUrl);
          
          const { data: updateData, error: userUpdateError } = await supabase
            .from('users')
            .update({ profile_photo_url: profileUrl })
            .eq('id', userId)
            .select();

          if (userUpdateError) {
            console.error('❌ Failed to save profile photo URL to database:', userUpdateError);
            console.error('❌ Error details:', JSON.stringify(userUpdateError, null, 2));
            Alert.alert(
              'Warning',
              'Profile photo uploaded but failed to save to database. Please contact support.',
              [{ text: 'OK' }]
            );
          } else {
            console.log('✅ Driver profile photo URL saved to database successfully');
            console.log('✅ Updated data:', JSON.stringify(updateData, null, 2));
          }
        } else {
          console.log('⚠️ [STEP 3] NO - profileUrl is falsy, skipping database save');
          console.log('⚠️ [STEP 3] profileUrl value:', profileUrl);
        }

        // 4. Update driver profile with all information
        console.log('📝 Updating driver profile data...');
        const updateResult = await updateDriverData(userId, {
          address: formData.address,
          drivers_license_number: formData.driversLicenseNumber,
          license_expiry_date: formData.licenseExpiryDate,
          license_front_photo_url: licenseFrontUrl,
          license_back_photo_url: licenseBackUrl,
          plate_number: formData.plateNumber,
          orcr_photo_url: orcrUrl,
          vehicle_model: formData.vehicleModel,
          vehicle_color: formData.vehicleColor,
          franchise_number: formData.franchiseNumber || undefined,
          verification_status: 'pending',
        });

        if (!updateResult.success) {
          Alert.alert('Error', 'Failed to save driver details. Please try again.');
          return;
        }

        console.log('✅ Driver profile updated successfully');

        // 4. Success! Notify driver
        Alert.alert(
          'Application Submitted!',
          `Your driver account has been created and submitted for verification.\n\nYou can log in with:\nEmail: ${formData.email}\nPassword: (the password you just entered)\n\nWe will review your documents and notify you once approved.`,
          [{ text: 'OK', onPress: () => onSubmit(formData) }]
        );
      } catch (error: any) {
        console.error('Error creating driver account:', error);
        Alert.alert('Error', error.message || 'An unexpected error occurred. Please try again.');
      }
    } else {
      Alert.alert('Validation Error', 'Please fill in all required fields correctly');
    }
  };

  const updateField = (field: keyof DriverFormData, value: string) => {
    console.log(`[CreateAccountDriver] Field updated: ${field} = ${value}`);
    
    // Special logging for profile photo
    if (field === 'profilePhoto') {
      if (value) {
        console.log('✅ [CreateAccountDriver] Profile photo selected!');
        console.log('📸 [CreateAccountDriver] Profile photo URI:', value);
      } else {
        console.log('⚠️ [CreateAccountDriver] Profile photo cleared');
      }
    }
    
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Blank illustration area at top */}
        <View style={styles.illustrationContainer} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Register</Text>
          <Text style={styles.subtitle}>Please register to login.</Text>
        </View>

        <View style={styles.form}>
          {/* Personal Information */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>
            
            <ImagePicker
              label="Profile Photo (optional)"
              onImageSelected={(uri) => updateField('profilePhoto', uri)}
              currentImage={formData.profilePhoto}
            />

            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChangeText={(text) => updateField('fullName', text)}
              error={errors.fullName}
              icon="person-outline"
            />

            <Input
              label="Phone Number"
              placeholder="09XX XXX XXXX"
              value={formData.phoneNumber}
              onChangeText={(text) => updateField('phoneNumber', text)}
              error={errors.phoneNumber}
              icon="call-outline"
              keyboardType="phone-pad"
            />

            <Input
              label="Email"
              placeholder="your.email@example.com"
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              error={errors.email}
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Input
              label="Password"
              placeholder="Enter a password (min 6 characters)"
              value={formData.password}
              onChangeText={(text) => updateField('password', text)}
              error={errors.password}
              icon="lock-closed-outline"
              secureTextEntry
            />

            <Input
              label="Address"
              placeholder="Enter your complete address"
              value={formData.address}
              onChangeText={(text) => updateField('address', text)}
              error={errors.address}
              icon="location-outline"
              multiline
            />
          </Card>

          {/* Driver Identification */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="card" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Driver Identification</Text>
            </View>

            <Input
              label="Driver's License Number"
              placeholder="Enter license number"
              value={formData.driversLicenseNumber}
              onChangeText={(text) => updateField('driversLicenseNumber', text)}
              error={errors.driversLicenseNumber}
              icon="id-card-outline"
            />

            <Input
              label="License Expiry Date"
              placeholder="MM/DD/YYYY"
              value={formData.licenseExpiryDate}
              onChangeText={(text) => updateField('licenseExpiryDate', text)}
              error={errors.licenseExpiryDate}
              icon="calendar-outline"
            />

            <ImagePicker
              label="License Front Photo"
              onImageSelected={(uri) => updateField('licenseFrontPhoto', uri)}
              currentImage={formData.licenseFrontPhoto}
              aspect={[16, 9]}
            />

            <ImagePicker
              label="License Back Photo"
              onImageSelected={(uri) => updateField('licenseBackPhoto', uri)}
              currentImage={formData.licenseBackPhoto}
              aspect={[16, 9]}
            />
          </Card>

          {/* Vehicle Information */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="bicycle" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Vehicle Information</Text>
            </View>

            <View style={styles.vehicleTypeBadge}>
              <Ionicons name="bicycle" size={20} color={colors.primary} />
              <Text style={styles.vehicleTypeText}>Vehicle Type: Tricycle</Text>
            </View>

            <Input
              label="Plate Number"
              placeholder="ABC 1234"
              value={formData.plateNumber}
              onChangeText={(text) => updateField('plateNumber', text.toUpperCase())}
              error={errors.plateNumber}
              icon="car-outline"
              autoCapitalize="characters"
            />

            <ImagePicker
              label="OR/CR Photo"
              onImageSelected={(uri) => updateField('orcrPhoto', uri)}
              currentImage={formData.orcrPhoto}
              aspect={[16, 9]}
            />

            <Input
              label="Vehicle Model/Brand"
              placeholder="e.g., Honda TMX 155"
              value={formData.vehicleModel}
              onChangeText={(text) => updateField('vehicleModel', text)}
              error={errors.vehicleModel}
              icon="construct-outline"
            />

            <Input
              label="Color"
              placeholder="e.g., Red, Blue, White"
              value={formData.vehicleColor}
              onChangeText={(text) => updateField('vehicleColor', text)}
              error={errors.vehicleColor}
              icon="color-palette-outline"
            />

            <Input
              label="Franchise/Body Number (Optional)"
              placeholder="Enter franchise number if applicable"
              value={formData.franchiseNumber}
              onChangeText={(text) => updateField('franchiseNumber', text)}
              icon="receipt-outline"
            />
          </Card>
        </View>

        <Button
          title="Submit Driver Account"
          onPress={handleSubmit}
          style={styles.submitButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Light peach/off-white background
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  illustrationContainer: {
    height: 200,
    width: '100%',
    marginBottom: spacing.xl,
    // Blank area for illustration - user will add image later
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary, // Dark blue/teal
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    fontWeight: '400',
  },
  form: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionCard: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.darkText,
  },
  vehicleTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lightGray,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  vehicleTypeText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  submitButton: {
    marginBottom: spacing.xl,
  },
});





