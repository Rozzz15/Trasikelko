import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, BottomNavigation, Button, SafetyBadge } from '../components';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePickerLib from 'expo-image-picker';
import { uploadIdPhoto, requestDiscountVerification, getDiscountStatus } from '../services/discountService';
import { supabase } from '../config/supabase';
import { 
  getCurrentUserFromSupabase, 
  getPassengerFromSupabase, 
  updateUserProfileInSupabase,
  updatePassengerDataInSupabase 
} from '../services/userService';
import { saveImagePermanently } from '../utils/imageStorage';
import { calculateSafetyBadge, getDriverSafetyRecord } from '../services/safetyService';
import { uploadProfilePhoto } from '../services/storageService';

interface ProfileScreenProps {
  userType: 'passenger' | 'driver';
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSOSPress: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userType,
  activeTab,
  onTabChange,
  onSOSPress,
  onLogout,
}) => {
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    email: '',
    profilePhoto: undefined as string | undefined,
    address: undefined as string | undefined,
    licenseNumber: undefined as string | undefined,
    plateNumber: undefined as string | undefined,
    verificationStatus: undefined as 'verified' | 'pending' | 'rejected' | undefined,
    isSeniorCitizen: false,
    isPWD: false,
    seniorCitizenId: undefined as string | undefined,
    pwdId: undefined as string | undefined,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageTitle, setImageTitle] = useState<string>('');
  const [licenseFrontPhoto, setLicenseFrontPhoto] = useState<string | undefined>(undefined);
  const [licenseBackPhoto, setLicenseBackPhoto] = useState<string | undefined>(undefined);
  const [orcrPhoto, setOrcrPhoto] = useState<string | undefined>(undefined);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangeEmailModal, setShowChangeEmailModal] = useState(false);
  const [showChangeNameModal, setShowChangeNameModal] = useState(false);
  const [showChangePhoneModal, setShowChangePhoneModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
  // Discount verification state
  const [discountStatus, setDiscountStatus] = useState<{
    type: 'none' | 'senior' | 'pwd';
    verification_status: 'none' | 'pending' | 'approved' | 'rejected';
    id_photo_url?: string;
    rejection_reason?: string;
  }>({
    type: 'none',
    verification_status: 'none',
  });
  const [uploadingId, setUploadingId] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [safetyBadge, setSafetyBadge] = useState<'green' | 'yellow' | 'red'>('yellow');
  const [driverAccount, setDriverAccount] = useState<any>(null);

  // Load user data from Supabase
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await getCurrentUserFromSupabase();
        if (!user) {
          Alert.alert('Error', 'Unable to load user data. Please login again.');
          setIsLoading(false);
          return;
        }

        // For passengers, get passenger-specific data
        if (userType === 'passenger') {
          const passenger = await getPassengerFromSupabase(user.id);
          if (passenger) {
            setProfileData({
              name: passenger.full_name,
              phone: passenger.phone_number,
              email: passenger.email,
              profilePhoto: passenger.profile_photo_url,
              address: undefined,
              licenseNumber: undefined,
              plateNumber: undefined,
              verificationStatus: undefined,
              isSeniorCitizen: passenger.is_senior_citizen || false,
              isPWD: passenger.is_pwd || false,
              seniorCitizenId: passenger.senior_citizen_id,
              pwdId: passenger.pwd_id,
            });
          }
        } else {
          // For drivers, get driver-specific data
          const { data: driver, error } = await supabase
            .from('drivers')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error || !driver) {
            Alert.alert('Error', 'Unable to load driver data');
            setIsLoading(false);
            return;
          }

          const verificationStatus = driver.verification_status || 'pending';
          
          setProfileData({
            name: user.full_name,
            phone: user.phone_number,
            email: user.email,
            profilePhoto: user.profile_photo_url,
            address: driver.address,
            licenseNumber: driver.drivers_license_number,
            plateNumber: driver.plate_number,
            verificationStatus: verificationStatus as 'verified' | 'pending' | 'rejected',
            isSeniorCitizen: false,
            isPWD: false,
            seniorCitizenId: undefined,
            pwdId: undefined,
          });

          setDriverAccount(driver);
          setLicenseFrontPhoto(driver.license_front_photo_url);
          setLicenseBackPhoto(driver.license_back_photo_url);
          setOrcrPhoto(driver.orcr_photo_url);

          // Load safety badge for verified drivers
          if (verificationStatus === 'verified') {
            try {
              const badge = await calculateSafetyBadge(user.email);
              setSafetyBadge(badge);
            } catch (error) {
              console.error('Error loading safety badge:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [userType]);

  const tabs = [
    { name: 'home', label: 'Home', icon: 'home-outline' as const, activeIcon: 'home' as const },
    { name: 'trips', label: 'Trips', icon: 'time-outline' as const, activeIcon: 'time' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
  ];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const user = await getCurrentUserFromSupabase();
      if (!user) {
        Alert.alert('Error', 'Unable to save. Please login again.');
        setIsSaving(false);
        return;
      }

      // Update user profile
      const result = await updateUserProfileInSupabase(user.id, {
        full_name: profileData.name,
        phone_number: profileData.phone,
        profile_photo_url: profileData.profilePhoto,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update passenger-specific data if passenger
      if (userType === 'passenger') {
        const passengerResult = await updatePassengerDataInSupabase(user.id, {
          is_senior_citizen: profileData.isSeniorCitizen,
          is_pwd: profileData.isPWD,
          senior_citizen_id: profileData.seniorCitizenId,
          pwd_id: profileData.pwdId,
        });

        if (!passengerResult.success) {
          throw new Error(passengerResult.error);
        }
      }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoSelect = async (uri: string) => {
    try {
      // Save the image to a permanent location
      const permanentUri = await saveImagePermanently(uri);
      setProfileData((prev) => ({ ...prev, profilePhoto: permanentUri }));
      // Show feedback that photo was selected
      Alert.alert('Photo Selected', 'Don\'t forget to save your profile to keep the changes.');
    } catch (error) {
      console.error('Error saving profile photo:', error);
      Alert.alert('Error', 'Failed to save photo. Please try again.');
      // Still set the URI even if save fails (fallback)
      setProfileData((prev) => ({ ...prev, profilePhoto: uri }));
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      Alert.alert('Success', 'Password changed successfully');
      setShowChangePasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail) {
      Alert.alert('Error', 'Please enter a new email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    try {
      const user = await getCurrentUserFromSupabase();
      if (!user) {
        Alert.alert('Error', 'Unable to update. Please login again.');
        return;
      }

      // Update email in Supabase Auth
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      
      if (error) throw error;

      Alert.alert('Success', 'Email updated successfully. Please check your inbox to confirm.');
      setShowChangeEmailModal(false);
      setNewEmail('');
      setProfileData(prev => ({ ...prev, email: newEmail }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update email');
    }
  };

  const handleChangeName = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    try {
      const user = await getCurrentUserFromSupabase();
      if (!user) {
        Alert.alert('Error', 'Unable to update. Please login again.');
        return;
      }

      const result = await updateUserProfileInSupabase(user.id, {
        full_name: newName.trim(),
      });

      if (!result.success) throw new Error(result.error);

      Alert.alert('Success', 'Name updated successfully');
      setShowChangeNameModal(false);
      setNewName('');
      setProfileData(prev => ({ ...prev, name: newName.trim() }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update name');
    }
  };

  const handleChangePhone = async () => {
    if (!newPhone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    try {
      const user = await getCurrentUserFromSupabase();
      if (!user) {
        Alert.alert('Error', 'Unable to update. Please login again.');
        return;
      }

      const result = await updateUserProfileInSupabase(user.id, {
        phone_number: newPhone.trim(),
      });

      if (!result.success) throw new Error(result.error);

      Alert.alert('Success', 'Phone number updated successfully');
      setShowChangePhoneModal(false);
      setNewPhone('');
      setProfileData(prev => ({ ...prev, phone: newPhone.trim() }));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update phone number');
    }
  };

  const menuItems = [
    { icon: 'help-circle-outline' as const, label: 'Support', onPress: () => Alert.alert('Support', 'Support screen') },
    { icon: 'alert-circle-outline' as const, label: 'SOS Help', onPress: onSOSPress, color: colors.error },
    { icon: 'document-text-outline' as const, label: 'Terms & Privacy', onPress: () => Alert.alert('Terms', 'Terms screen') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profileData.profilePhoto ? (
              <Image
                source={{ uri: profileData.profilePhoto }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={50} color={colors.gray} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.editAvatarButton, isUploadingPhoto && { opacity: 0.5 }]}
              disabled={isUploadingPhoto}
              onPress={() => {
                if (isUploadingPhoto) {
                  Alert.alert('Please Wait', 'Photo upload in progress...');
                  return;
                }
                // Show image picker options
                Alert.alert(
                  'Change Profile Photo',
                  'Choose an option',
                  [
                    {
                      text: 'Camera',
                      onPress: async () => {
                        const { status } = await ImagePickerLib.requestCameraPermissionsAsync();
                        if (status === 'granted') {
                          const result = await ImagePickerLib.launchCameraAsync({
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                          });
                          if (!result.canceled && result.assets[0]) {
                            try {
                              setIsUploadingPhoto(true);
                              Alert.alert('Uploading', 'Uploading photo to cloud storage...');
                              
                              // Get current user session
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session) {
                                Alert.alert('Error', 'Please log in again');
                                return;
                              }
                              
                              // Upload to Supabase Storage
                              const uploadResult = await uploadProfilePhoto(
                                session.user.id,
                                result.assets[0].uri
                              );
                              
                              if (uploadResult.success && uploadResult.url) {
                                // Save public URL to database
                                const { error: updateError } = await supabase
                                  .from('users')
                                  .update({ profile_photo_url: uploadResult.url })
                                  .eq('id', session.user.id);
                                
                                if (updateError) {
                                  throw new Error(updateError.message);
                                }
                                
                                // Update local state with cloud URL
                                setProfileData((prev) => ({ ...prev, profilePhoto: uploadResult.url }));
                                Alert.alert('Success', 'Profile photo updated successfully!');
                              } else {
                                throw new Error(uploadResult.error || 'Upload failed');
                              }
                            } catch (error: any) {
                              console.error('Error uploading profile photo:', error);
                              Alert.alert('Upload Failed', error.message || 'Failed to upload photo. Please try again.');
                            } finally {
                              setIsUploadingPhoto(false);
                            }
                          }
                        } else {
                          Alert.alert('Permission needed', 'Please grant camera permissions');
                        }
                      },
                    },
                    {
                      text: 'Gallery',
                      onPress: async () => {
                        const { status } = await ImagePickerLib.requestMediaLibraryPermissionsAsync();
                        if (status === 'granted') {
                          const result = await ImagePickerLib.launchImageLibraryAsync({
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                          });
                          if (!result.canceled && result.assets[0]) {
                            try {
                              setIsUploadingPhoto(true);
                              Alert.alert('Uploading', 'Uploading photo to cloud storage...');
                              
                              // Get current user session
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session) {
                                Alert.alert('Error', 'Please log in again');
                                return;
                              }
                              
                              // Upload to Supabase Storage
                              const uploadResult = await uploadProfilePhoto(
                                session.user.id,
                                result.assets[0].uri
                              );
                              
                              if (uploadResult.success && uploadResult.url) {
                                // Save public URL to database
                                const { error: updateError } = await supabase
                                  .from('users')
                                  .update({ profile_photo_url: uploadResult.url })
                                  .eq('id', session.user.id);
                                
                                if (updateError) {
                                  throw new Error(updateError.message);
                                }
                                
                                // Update local state with cloud URL
                                setProfileData((prev) => ({ ...prev, profilePhoto: uploadResult.url }));
                                Alert.alert('Success', 'Profile photo updated successfully!');
                              } else {
                                throw new Error(uploadResult.error || 'Upload failed');
                              }
                            } catch (error: any) {
                              console.error('Error uploading profile photo:', error);
                              Alert.alert('Upload Failed', error.message || 'Failed to upload photo. Please try again.');
                            } finally {
                              setIsUploadingPhoto(false);
                            }
                          }
                        } else {
                          Alert.alert('Permission needed', 'Please grant gallery permissions');
                        }
                      },
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
            >
              <Ionicons name="camera" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{profileData.name}</Text>
          <Text style={styles.profileSubtext}>
            {userType === 'passenger' ? 'Passenger' : 'Tricycle Driver'}
          </Text>
          {userType === 'driver' && profileData.verificationStatus && (
            <View style={styles.badgeRow}>
              <View style={[
                styles.verificationBadge,
                profileData.verificationStatus === 'verified' && styles.verificationBadgeVerified
              ]}>
                <Ionicons
                  name={profileData.verificationStatus === 'verified' ? 'checkmark-circle' : 'time'}
                  size={16}
                  color={profileData.verificationStatus === 'verified' ? colors.success : colors.warning}
                />
                <Text style={[
                  styles.verificationText,
                  profileData.verificationStatus === 'verified' && styles.verificationTextVerified
                ]}>
                  {profileData.verificationStatus === 'verified' ? 'Verified Driver' : 'Under Review'}
                </Text>
              </View>
              {profileData.verificationStatus === 'verified' && (
                <SafetyBadge badgeColor={safetyBadge} size="medium" />
              )}
            </View>
          )}
        </View>

        {/* Settings Section - Collapsible */}
        <Card style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.settingsHeader}
            onPress={() => setIsSettingsExpanded(!isSettingsExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="settings-outline" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Settings</Text>
            </View>
            <Ionicons
              name={isSettingsExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.gray}
            />
          </TouchableOpacity>

          {/* Personal Information inside Settings - Hidden by default */}
          {isSettingsExpanded && (
            <View style={styles.settingsSection}>
            <Text style={styles.subsectionTitle}>Personal Information</Text>
            
            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                setNewName(profileData.name);
                setShowChangeNameModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingsItemLeft}>
                <Ionicons name="person-outline" size={20} color={colors.primary} />
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemLabel}>Full Name</Text>
                  <Text style={styles.settingsItemValue}>{profileData.name}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                setNewPhone(profileData.phone);
                setShowChangePhoneModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingsItemLeft}>
                <Ionicons name="call-outline" size={20} color={colors.primary} />
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemLabel}>Phone Number</Text>
                  <Text style={styles.settingsItemValue}>{profileData.phone}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => {
                setNewEmail(profileData.email);
                setShowChangeEmailModal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingsItemLeft}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemLabel}>Email</Text>
                  <Text style={styles.settingsItemValue}>{profileData.email}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsItem}
              onPress={() => setShowChangePasswordModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingsItemLeft}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemLabel}>Password</Text>
                  <Text style={styles.settingsItemValue}>••••••••</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>

            {userType === 'driver' && profileData.address && (
              <View style={styles.settingsItem}>
                <Ionicons name="location-outline" size={20} color={colors.gray} />
                <View style={styles.settingsItemContent}>
                  <Text style={styles.settingsItemLabel}>Address</Text>
                  <Text style={styles.settingsItemValue}>{profileData.address}</Text>
                </View>
              </View>
            )}

            </View>
          )}
        </Card>

        {/* Driver Specific Information */}
        {userType === 'driver' && (
          <>
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Vehicle Information</Text>
              <View style={styles.infoList}>
                <View style={styles.infoItem}>
                  <Ionicons name="bicycle" size={20} color={colors.gray} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Vehicle Type</Text>
                    <Text style={styles.infoValue}>Tricycle</Text>
                  </View>
                </View>
                {profileData.plateNumber && (
                  <View style={styles.infoItem}>
                    <Ionicons name="car-outline" size={20} color={colors.gray} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Plate Number</Text>
                      <Text style={styles.infoValue}>{profileData.plateNumber}</Text>
                    </View>
                  </View>
                )}
              </View>
            </Card>

            {/* Verification Status Card */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Verification Status</Text>
              <View style={styles.verificationStatusContainer}>
                <View style={[
                  styles.verificationStatusBadge,
                  profileData.verificationStatus === 'verified' && styles.verificationStatusVerified,
                  profileData.verificationStatus === 'rejected' && styles.verificationStatusRejected,
                  profileData.verificationStatus === 'pending' && styles.verificationStatusPending,
                ]}>
                  {profileData.verificationStatus === 'verified' ? (
                    <>
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                      <Text style={[styles.verificationStatusText, styles.verificationStatusTextVerified]}>
                        ✅ Verified
                      </Text>
                    </>
                  ) : profileData.verificationStatus === 'rejected' ? (
                    <>
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                      <Text style={[styles.verificationStatusText, styles.verificationStatusTextRejected]}>
                        ❌ Rejected / Suspended
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="time" size={24} color={colors.warning} />
                      <Text style={[styles.verificationStatusText, styles.verificationStatusTextPending]}>
                        ⏳ Pending Review
                      </Text>
                    </>
                  )}
                </View>
                
                {profileData.verificationStatus === 'rejected' && driverAccount?.rejectionReason && (
                  <View style={styles.rejectionReasonContainer}>
                    <Text style={styles.rejectionReasonLabel}>Rejection Reason:</Text>
                    <Text style={styles.rejectionReasonText}>{driverAccount.rejectionReason}</Text>
                  </View>
                )}

                {driverAccount?.submittedAt && (
                  <View style={styles.submissionInfo}>
                    <Text style={styles.submissionLabel}>
                      Submitted: {new Date(driverAccount.submittedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                )}

                {driverAccount?.verifiedAt && profileData.verificationStatus === 'verified' && (
                  <View style={styles.submissionInfo}>
                    <Text style={styles.submissionLabel}>
                      Verified: {new Date(driverAccount.verifiedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>License Information</Text>
              <View style={styles.infoList}>
                {profileData.licenseNumber && (
                  <View style={styles.infoItem}>
                    <Ionicons name="id-card-outline" size={20} color={colors.gray} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>License Number</Text>
                      <Text style={styles.infoValue}>{profileData.licenseNumber}</Text>
                      {driverAccount?.licenseExpiryDate && (
                        <Text style={styles.expiryDate}>
                          Expires: {new Date(driverAccount.licenseExpiryDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                
                {driverAccount?.franchiseNumber && (
                  <View style={styles.infoItem}>
                    <Ionicons name="document-text-outline" size={20} color={colors.gray} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Franchise Number</Text>
                      <Text style={styles.infoValue}>{driverAccount.franchiseNumber}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.documentsSection}>
                  <Text style={styles.documentsSectionTitle}>Submitted Documents</Text>
                  
                  <View style={styles.documentList}>
                    {licenseFrontPhoto ? (
                      <View style={styles.documentItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.documentName}>Driver's License (Front)</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedImage(licenseFrontPhoto);
                            setImageTitle('Driver\'s License - Front');
                          }}
                        >
                          <Ionicons name="eye-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.documentItem}>
                        <Ionicons name="close-circle" size={16} color={colors.error} />
                        <Text style={styles.documentNameMissing}>Driver's License (Front) - Missing</Text>
                      </View>
                    )}

                    {licenseBackPhoto ? (
                      <View style={styles.documentItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.documentName}>Driver's License (Back)</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedImage(licenseBackPhoto);
                            setImageTitle('Driver\'s License - Back');
                          }}
                        >
                          <Ionicons name="eye-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.documentItem}>
                        <Ionicons name="close-circle" size={16} color={colors.error} />
                        <Text style={styles.documentNameMissing}>Driver's License (Back) - Missing</Text>
                      </View>
                    )}

                    {orcrPhoto ? (
                      <View style={styles.documentItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.documentName}>OR/CR Document</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedImage(orcrPhoto);
                            setImageTitle('OR/CR Document');
                          }}
                        >
                          <Ionicons name="eye-outline" size={18} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.documentItem}>
                        <Ionicons name="close-circle" size={16} color={colors.error} />
                        <Text style={styles.documentNameMissing}>OR/CR Document - Missing</Text>
                      </View>
                    )}
                  </View>

                  {(profileData.verificationStatus === 'rejected' || profileData.verificationStatus === 'pending') && (
                    <TouchableOpacity
                      style={styles.updateDocumentsButton}
                      onPress={() => {
                        Alert.alert(
                          'Update Documents',
                          'To update your documents, please contact support or re-submit your application. Your updated documents will be reviewed by an administrator.',
                          [{ text: 'OK' }]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
                      <Text style={styles.updateDocumentsText}>Update Documents</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={24}
                color={item.color || colors.primary}
              />
              <Text style={[styles.menuItemText, item.color && { color: item.color }]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert(
              'Confirm Logout',
              `Are you sure you want to logout from your ${userType === 'passenger' ? 'passenger' : 'driver'} account?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Logout',
                  style: 'destructive',
                  onPress: async () => {
                    // If driver, set status to offline before logout
                    if (userType === 'driver') {
                      try {
                        console.log('[ProfileScreen] Driver logging out - setting status to offline...');
                        const { getCurrentUser } = require('../utils/sessionHelper');
                        const user = await getCurrentUser();
                        if (user?.id) {
                          const { updateDriverStatus, removeDriverLocation } = require('../services/driverService');
                          await updateDriverStatus(user.id, 'offline');
                          await removeDriverLocation(user.id);
                          console.log('[ProfileScreen] Driver status set to offline');
                        }
                      } catch (error) {
                        console.error('[ProfileScreen] Error setting driver offline:', error);
                      }
                    }
                    // Call the actual logout
                    onLogout();
                  },
                },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={onTabChange}
      />

      {/* Full Size Image Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageModalContainer}>
          <View style={styles.imageModalHeader}>
            <Text style={styles.imageModalTitle}>{imageTitle}</Text>
            <TouchableOpacity
              onPress={() => setSelectedImage(null)}
              style={styles.imageModalCloseButton}
            >
              <Ionicons name="close" size={28} color={colors.white} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.imageModalContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullSizeImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setShowChangePasswordModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>New Password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry
                />
              </View>
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>Confirm Password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry
                />
              </View>
              <Button
                title="Change Password"
                onPress={handleChangePassword}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Email Modal */}
      <Modal
        visible={showChangeEmailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangeEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Email</Text>
              <TouchableOpacity onPress={() => setShowChangeEmailModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>New Email</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="Enter new email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <Button
                title="Change Email"
                onPress={handleChangeEmail}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Name Modal */}
      <Modal
        visible={showChangeNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangeNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Name</Text>
              <TouchableOpacity onPress={() => setShowChangeNameModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>Full Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Enter your full name"
                />
              </View>
              <Button
                title="Change Name"
                onPress={handleChangeName}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Phone Modal */}
      <Modal
        visible={showChangePhoneModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePhoneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Phone Number</Text>
              <TouchableOpacity onPress={() => setShowChangePhoneModal(false)}>
                <Ionicons name="close" size={24} color={colors.gray} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={styles.modalInputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                />
              </View>
              <Button
                title="Change Phone Number"
                onPress={handleChangePhone}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.lightGray,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 8,
    ...require('../theme').shadows.small,
  },
  profileName: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  profileSubtext: {
    ...typography.body,
    color: colors.gray,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lightGray,
  },
  verificationBadgeVerified: {
    backgroundColor: '#E8F5E9',
  },
  verificationText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  verificationTextVerified: {
    color: colors.success,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.darkText,
  },
  settingsSection: {
    marginTop: spacing.sm,
  },
  subsectionTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.gray,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
    marginBottom: 2,
  },
  settingsItemValue: {
    ...typography.body,
    fontSize: 15,
    color: colors.darkText,
    fontWeight: '500',
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
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 20,
    fontWeight: '700',
    color: colors.darkText,
  },
  modalBody: {
    gap: spacing.md,
  },
  modalInputContainer: {
    marginBottom: spacing.md,
  },
  modalInputLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.darkText,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  modalInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    fontSize: 16,
  },
  modalButton: {
    marginTop: spacing.md,
  },
  infoList: {
    gap: spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 2,
  },
  infoValue: {
    ...typography.body,
    color: colors.darkText,
  },
  editInputText: {
    ...typography.body,
    color: colors.darkText,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: colors.white,
    minHeight: 40,
  },
  editInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  viewDocumentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  viewDocumentsText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  menuSection: {
    marginBottom: spacing.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...require('../theme').shadows.small,
  },
  menuItemText: {
    ...typography.body,
    flex: 1,
    color: colors.darkText,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error + '10',
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  logoutButtonText: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.error,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.xl,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageModalTitle: {
    ...typography.h3,
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  imageModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: Dimensions.get('window').width,
    paddingVertical: spacing.xl,
  },
  fullSizeImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').width * 1.5,
  },
  verificationStatusContainer: {
    gap: spacing.md,
  },
  verificationStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
  },
  verificationStatusVerified: {
    backgroundColor: '#E8F5E9',
  },
  verificationStatusPending: {
    backgroundColor: '#FFF3E0',
  },
  verificationStatusRejected: {
    backgroundColor: '#FFEBEE',
  },
  verificationStatusText: {
    ...typography.bodyBold,
    fontSize: 16,
    fontWeight: '700',
  },
  verificationStatusTextVerified: {
    color: colors.success,
  },
  verificationStatusTextPending: {
    color: colors.warning,
  },
  verificationStatusTextRejected: {
    color: colors.error,
  },
  rejectionReasonContainer: {
    padding: spacing.md,
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  rejectionReasonLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  rejectionReasonText: {
    ...typography.body,
    fontSize: 14,
    color: colors.darkText,
  },
  submissionInfo: {
    marginTop: spacing.xs,
  },
  submissionLabel: {
    ...typography.caption,
    fontSize: 12,
    color: colors.gray,
  },
  expiryDate: {
    ...typography.caption,
    fontSize: 12,
    color: colors.warning,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  documentsSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  documentsSectionTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  documentList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.sm,
  },
  documentName: {
    ...typography.body,
    fontSize: 14,
    flex: 1,
    color: colors.darkText,
  },
  documentNameMissing: {
    ...typography.body,
    fontSize: 14,
    flex: 1,
    color: colors.error,
    fontStyle: 'italic',
  },
  updateDocumentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  updateDocumentsText: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.white,
  },
});
