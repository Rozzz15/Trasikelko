import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetStarted = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* App Name */}
      <Animated.View
        style={[
          styles.appNameSection,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.appNameContainer}>
          <Text style={styles.appNameMain}>TRAYSIKEL</Text>
          <Text style={styles.appNameSub}>KO</Text>
        </View>
      </Animated.View>

      {/* Logo image in middle */}
      <Animated.View
        style={[
          styles.illustrationSection,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/TRAYSIKEL.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Tagline below illustration */}
      <Animated.View
        style={[
          styles.taglineSection,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <Text style={styles.tagline}>Hanap Traysikel? Traysikel KO!</Text>
      </Animated.View>

      {/* Button at bottom */}
      <Animated.View
        style={[
          styles.buttonSection,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity style={styles.button} onPress={handleGetStarted}>
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.buttonIcon} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F5', // Light peach/off-white background
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: spacing.lg,
  },
  appNameSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  appNameMain: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  appNameSub: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FF9500', // Orange accent
    letterSpacing: 2,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  illustrationSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  imageContainer: {
    backgroundColor: '#FFF8F5', // Match splash screen background exactly
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 300,
    height: 300,
    maxWidth: '90%',
    maxHeight: '90%',
    backgroundColor: '#FFF8F5', // Match splash screen background
  },
  taglineSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  tagline: {
    fontSize: 18,
    color: '#1D1D1D', // Dark gray/black
    textAlign: 'center',
    fontWeight: '400',
  },
  buttonSection: {
    width: '100%',
  },
  button: {
    backgroundColor: '#FF9500', // Bright orange
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  buttonIcon: {
    marginLeft: spacing.xs,
  },
});





