import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerOptions } from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';

interface ImagePickerProps {
  label?: string;
  onImageSelected: (uri: string) => void;
  currentImage?: string;
  aspect?: [number, number];
}

export const CustomImagePicker: React.FC<ImagePickerProps> = ({
  label,
  onImageSelected,
  currentImage,
  aspect = [1, 1],
}) => {
  const [image, setImage] = useState<string | undefined>(currentImage);

  const pickImage = async () => {
    try {
      // Request media library permissions (returns current status if already granted)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed', 
          'Please grant camera roll permissions to select photos from your gallery.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'OK'
            }
          ]
        );
        return;
      }

      // Launch image library - mediaTypes can be omitted as images is default
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (uri) {
          setImage(uri);
          onImageSelected(uri);
        } else {
          Alert.alert('Error', 'Failed to load image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error picking image from gallery:', error);
      Alert.alert(
        'Error', 
        'Failed to open gallery. Please make sure you have granted the necessary permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed', 
          'Please grant camera permissions to take photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'OK'
            }
          ]
        );
        return;
      }

      // Launch camera with proper error handling
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect,
        quality: 0.8,
        exif: false, // Disable EXIF to prevent issues
      });

      // Check if result is valid
      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset && asset.uri) {
          setImage(asset.uri);
          onImageSelected(asset.uri);
        } else {
          Alert.alert('Error', 'Failed to load image. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(
        'Error', 
        'Failed to open camera. Please make sure you have granted the necessary permissions and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Select Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: takePhoto },
        { text: 'Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.imageContainer, image && styles.imageContainerWithImage]}
        onPress={showImageOptions}
        activeOpacity={0.7}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="camera" size={32} color={colors.gray} />
            <Text style={styles.placeholderText}>Tap to add photo</Text>
          </View>
        )}
      </TouchableOpacity>
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
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  imageContainerWithImage: {
    borderStyle: 'solid',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.caption,
    marginTop: spacing.sm,
    color: colors.gray,
  },
});





