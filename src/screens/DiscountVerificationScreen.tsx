// Discount Verification Screen
// Allows passengers to upload ID photos for Senior Citizen or PWD discount verification

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button } from '../components';
import { colors, typography, spacing } from '../theme';
import { 
  uploadIdPhoto, 
  requestDiscountVerification, 
  getDiscountStatus 
} from '../services/discountService';
import { getCurrentUserFromSupabase } from '../services/userService';

interface DiscountVerificationScreenProps {
  navigation: any;
}

export const DiscountVerificationScreen: React.FC<DiscountVerificationScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadStep, setUploadStep] = useState<'front' | 'back' | null>(null);
  const [frontPhotoUri, setFrontPhotoUri] = useState<string | null>(null);
  const [backPhotoUri, setBackPhotoUri] = useState<string | null>(null);
  const [selectedDiscountType, setSelectedDiscountType] = useState<'senior' | 'pwd' | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; label: string } | null>(null);
  const [discountStatus, setDiscountStatus] = useState<{
    type: 'none' | 'senior' | 'pwd';
    verification_status: 'none' | 'pending' | 'approved' | 'rejected';
    id_photo_url?: string;
    rejection_reason?: string;
  }>({
    type: 'none',
    verification_status: 'none',
  });

  useEffect(() => {
    loadDiscountStatus();
    
    // Set up auto-refresh every 5 seconds to check for admin approval
    const interval = setInterval(() => {
      loadDiscountStatus();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDiscountStatus = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      }
      const user = await getCurrentUserFromSupabase();
      console.log('[DiscountVerification] Loading status for user:', user?.id);
      if (user) {
        const result = await getDiscountStatus(user.id);
        console.log('[DiscountVerification] Got discount status:', result);
        if (result.success && result.status) {
          console.log('[DiscountVerification] Setting status:', result.status.verification_status);
          setDiscountStatus(result.status);
        }
      }
    } catch (error) {
      console.error('[DiscountVerification] Error loading discount status:', error);
    } finally {
      setLoading(false);
      if (showRefreshing) {
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = async () => {
    await loadDiscountStatus(true);
  };

  const handleUploadId = async (type: 'senior' | 'pwd') => {
    setSelectedDiscountType(type);
    setUploadStep('front');
    setFrontPhotoUri(null);
    setBackPhotoUri(null);
    
    Alert.alert(
      'Upload ID Photos',
      `Please upload BOTH front and back photos of your ${type === 'senior' ? 'Senior Citizen' : 'PWD'} ID.\n\nYou will be prompted to upload:\n1. Front of ID\n2. Back of ID`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => uploadFrontPhoto(type) }
      ]
    );
  };

  const uploadFrontPhoto = async (type: 'senior' | 'pwd') => {
    try {
      setUploading(true);

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photos to upload your ID.');
        setUploading(false);
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) {
        setUploading(false);
        setUploadStep(null);
        return;
      }

      const photoUri = result.assets[0].uri;
      setFrontPhotoUri(photoUri);
      setUploading(false);
      
      // Now prompt for back photo
      Alert.alert(
        'Front Photo Uploaded',
        'Now upload the BACK of your ID',
        [{ text: 'Continue', onPress: () => uploadBackPhoto(type) }]
      );
    } catch (error) {
      console.error('Error uploading front:', error);
      Alert.alert('Error', 'Failed to upload front photo');
      setUploading(false);
      setUploadStep(null);
    }
  };

  const uploadBackPhoto = async (type: 'senior' | 'pwd') => {
    try {
      setUploading(true);

      // Launch image picker for back
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) {
        setUploading(false);
        setUploadStep(null);
        return;
      }

      const photoUri = result.assets[0].uri;
      setBackPhotoUri(photoUri);
      
      // Now upload both photos
      await submitBothPhotos(type);
    } catch (error) {
      console.error('Error uploading back:', error);
      Alert.alert('Error', 'Failed to upload back photo');
      setUploading(false);
      setUploadStep(null);
    }
  };

  const submitBothPhotos = async (type: 'senior' | 'pwd') => {
    try {
      if (!frontPhotoUri || !backPhotoUri) {
        Alert.alert('Error', 'Both front and back photos are required');
        setUploading(false);
        return;
      }

      // Get user
      const user = await getCurrentUserFromSupabase();
      if (!user) {
        Alert.alert('Error', 'User not found');
        setUploading(false);
        return;
      }

      // Upload front photo
      const frontUploadResult = await uploadIdPhoto(user.id, frontPhotoUri, type);
      if (!frontUploadResult.success || !frontUploadResult.url) {
        Alert.alert('Upload Failed', 'Failed to upload front photo: ' + (frontUploadResult.error || 'Unknown error'));
        setUploading(false);
        return;
      }

      // Upload back photo
      const backUploadResult = await uploadIdPhoto(user.id, backPhotoUri, type);
      if (!backUploadResult.success || !backUploadResult.url) {
        Alert.alert('Upload Failed', 'Failed to upload back photo: ' + (backUploadResult.error || 'Unknown error'));
        setUploading(false);
        return;
      }

      // Combine URLs (store both URLs separated by comma)
      const combinedUrls = `${frontUploadResult.url}|${backUploadResult.url}`;

      // Request verification with both URLs
      const requestResult = await requestDiscountVerification(user.id, type, combinedUrls);
      if (!requestResult.success) {
        Alert.alert('Error', requestResult.error || 'Failed to submit request');
        setUploading(false);
        return;
      }

      // Update status
      setDiscountStatus({
        type,
        verification_status: 'pending',
        id_photo_url: combinedUrls,
      });

      Alert.alert(
        'Submitted Successfully!',
        `Your ${type === 'senior' ? 'Senior Citizen' : 'PWD'} ID (front and back) has been submitted for verification. You'll be notified once approved.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

      setUploading(false);
      setUploadStep(null);
      setFrontPhotoUri(null);
      setBackPhotoUri(null);
    } catch (error) {
      console.error('Error submitting photos:', error);
      Alert.alert('Error', 'Failed to submit ID photos');
      setUploading(false);
    }
  };

  const getStatusBadge = () => {
    switch (discountStatus.verification_status) {
      case 'pending':
        return { text: 'Under Review', color: colors.warning, icon: 'time' as const };
      case 'approved':
        return { text: 'Approved', color: colors.success, icon: 'checkmark-circle' as const };
      case 'rejected':
        return { text: 'Rejected', color: colors.error, icon: 'close-circle' as const };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const statusBadge = getStatusBadge();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.darkText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discount Verification</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Current Status */}
        {discountStatus.verification_status !== 'none' && (
          <>
            {console.log('[DiscountVerification] Rendering status card. Status:', discountStatus.verification_status, 'Type:', discountStatus.type, 'Photo URL:', discountStatus.id_photo_url)}
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>Current Status</Text>
              {statusBadge && (
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
                  <Ionicons name={statusBadge.icon} size={16} color={colors.white} />
                  <Text style={styles.statusBadgeText}>{statusBadge.text}</Text>
                </View>
              )}
            </View>

            <View style={styles.statusDetails}>
              <Text style={styles.statusLabel}>Discount Type:</Text>
              <Text style={styles.statusValue}>
                {discountStatus.type === 'senior' ? 'Senior Citizen (20% off)' : 'PWD (20% off)'}
              </Text>
            </View>

            {discountStatus.id_photo_url && (
              <View style={styles.idPhotoContainer}>
                <Text style={styles.statusLabel}>Uploaded ID Photos:</Text>
                {discountStatus.id_photo_url.includes('|') ? (
                  <>
                    {/* Front and Back Photos */}
                    <View style={styles.photoRow}>
                      <View style={styles.photoWrapper}>
                        <Text style={styles.photoLabel}>Front</Text>
                        <TouchableOpacity
                          onPress={() => setViewingPhoto({
                            url: discountStatus.id_photo_url?.split('|')[0] || '',
                            label: 'Front of ID'
                          })}
                          activeOpacity={0.8}
                        >
                          <Image 
                            source={{ uri: discountStatus.id_photo_url?.split('|')[0] }} 
                            style={styles.idPhoto}
                            resizeMode="cover"
                          />
                          <View style={styles.zoomHint}>
                            <Ionicons name="expand-outline" size={16} color={colors.white} />
                          </View>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.photoWrapper}>
                        <Text style={styles.photoLabel}>Back</Text>
                        <TouchableOpacity
                          onPress={() => setViewingPhoto({
                            url: discountStatus.id_photo_url?.split('|')[1] || '',
                            label: 'Back of ID'
                          })}
                          activeOpacity={0.8}
                        >
                          <Image 
                            source={{ uri: discountStatus.id_photo_url.split('|')[1] }} 
                            style={styles.idPhoto}
                            resizeMode="cover"
                          />
                          <View style={styles.zoomHint}>
                            <Ionicons name="expand-outline" size={16} color={colors.white} />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                ) : (
                  <Image 
                    source={{ uri: discountStatus.id_photo_url }} 
                    style={styles.idPhoto}
                    resizeMode="cover"
                  />
                )}
              </View>
            )}

            {discountStatus.verification_status === 'rejected' && discountStatus.rejection_reason && (
              <View style={styles.rejectionContainer}>
                <Ionicons name="information-circle" size={20} color={colors.error} />
                <Text style={styles.rejectionText}>{discountStatus.rejection_reason}</Text>
              </View>
            )}
          </Card>
          </>
        )}

        {/* Information Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.infoTitle}>Discount Eligibility</Text>
          </View>
          <Text style={styles.infoText}>
            Upload your Senior Citizen or PWD ID to get a 20% discount on all rides.
          </Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.infoItemText}>Valid for both Ride Now and Schedule Ride</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.infoItemText}>Admin will review within 24-48 hours</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.infoItemText}>Only one discount type allowed</Text>
            </View>
          </View>
        </Card>

        {/* Upload Buttons */}
        {(discountStatus.verification_status === 'none' || discountStatus.verification_status === 'rejected') && (
          <View style={styles.uploadSection}>
            <Text style={styles.uploadTitle}>Choose Discount Type:</Text>
            
            <TouchableOpacity
              style={styles.uploadCard}
              onPress={() => handleUploadId('senior')}
              disabled={uploading}
            >
              <View style={styles.uploadIconContainer}>
                <Ionicons name="person" size={40} color={colors.primary} />
              </View>
              <View style={styles.uploadContent}>
                <Text style={styles.uploadCardTitle}>Senior Citizen</Text>
                <Text style={styles.uploadCardSubtitle}>60 years old and above</Text>
                <Text style={styles.uploadCardDiscount}>20% discount on all rides</Text>
              </View>
              <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadCard}
              onPress={() => handleUploadId('pwd')}
              disabled={uploading}
            >
              <View style={styles.uploadIconContainer}>
                <Ionicons name="heart" size={40} color={colors.primary} />
              </View>
              <View style={styles.uploadContent}>
                <Text style={styles.uploadCardTitle}>PWD (Person with Disability)</Text>
                <Text style={styles.uploadCardSubtitle}>Valid PWD ID holder</Text>
                <Text style={styles.uploadCardDiscount}>20% discount on all rides</Text>
              </View>
              <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            </TouchableOpacity>

            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.uploadingText}>Uploading...</Text>
              </View>
            )}
          </View>
        )}

        {/* Approved Message */}
        {discountStatus.verification_status === 'approved' && (
          <Card style={styles.approvedCard}>
            <Ionicons name="checkmark-circle" size={60} color={colors.success} />
            <Text style={styles.approvedTitle}>Discount Approved!</Text>
            <Text style={styles.approvedText}>
              You can now enjoy 20% off on all your rides.
            </Text>
            <Button
              title="Start Booking"
              onPress={() => navigation.navigate('PassengerHome')}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Pending Message */}
        {discountStatus.verification_status === 'pending' && (
          <Card style={styles.pendingCard}>
            <Ionicons name="time-outline" size={60} color={colors.warning} />
            <Text style={styles.pendingTitle}>Under Review</Text>
            <Text style={styles.pendingText}>
              Your ID is being reviewed by our admin team. You'll be notified once approved.
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Photo Zoom Modal */}
      <Modal
        visible={viewingPhoto !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setViewingPhoto(null)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{viewingPhoto?.label}</Text>
                <TouchableOpacity
                  onPress={() => setViewingPhoto(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={28} color={colors.white} />
                </TouchableOpacity>
              </View>
              
              {viewingPhoto && (
                <Image
                  source={{ uri: viewingPhoto.url }}
                  style={styles.fullSizeImage}
                  resizeMode="contain"
                />
              )}
              
              <Text style={styles.zoomInstructions}>
                Tap anywhere to close
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightGray,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  statusCard: {
    marginBottom: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusTitle: {
    ...typography.h4,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  statusDetails: {
    marginBottom: spacing.sm,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 4,
  },
  statusValue: {
    ...typography.body,
    fontWeight: '600',
  },
  idPhotoContainer: {
    marginTop: spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  photoWrapper: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  idPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: colors.lightGray,
  },
  rejectionContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.error + '10',
    borderRadius: 8,
    marginTop: spacing.sm,
  },
  rejectionText: {
    flex: 1,
    color: colors.error,
    fontSize: 14,
  },
  infoCard: {
    marginBottom: spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoTitle: {
    ...typography.h4,
    fontWeight: '700',
  },
  infoText: {
    ...typography.body,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  infoList: {
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoItemText: {
    flex: 1,
    ...typography.body,
  },
  uploadSection: {
    marginBottom: spacing.xl,
  },
  uploadTitle: {
    ...typography.h4,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  uploadIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  uploadContent: {
    flex: 1,
  },
  uploadCardTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  uploadCardSubtitle: {
    ...typography.caption,
    color: colors.gray,
    marginBottom: 4,
  },
  uploadCardDiscount: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    marginTop: spacing.sm,
    ...typography.body,
    color: colors.primary,
  },
  approvedCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  approvedTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.success,
    marginTop: spacing.md,
  },
  approvedText: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  pendingCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  pendingTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.warning,
    marginTop: spacing.md,
  },
  pendingText: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  zoomHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 6,
  },
  // Photo Zoom Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  modalOverlay: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.white,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.xs,
  },
  fullSizeImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  zoomInstructions: {
    position: 'absolute',
    bottom: 50,
    ...typography.body,
    color: colors.white,
    opacity: 0.7,
  },
});
