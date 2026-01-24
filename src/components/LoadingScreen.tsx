import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Image } from 'react-native';
import { colors, spacing } from '../theme';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  fullScreen = true 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Pulse animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const containerStyle = fullScreen ? styles.fullScreenContainer : styles.inlineContainer;

  return (
    <View style={containerStyle}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        {/* App Name - matching SplashScreen */}
        <View style={styles.appNameContainer}>
          <Text style={styles.appNameMain}>TRAYSIKEL</Text>
          <Text style={styles.appNameSub}>KO</Text>
        </View>

        {/* Logo with pulse animation */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/traysi.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Loading spinner */}
        <View style={styles.spinnerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>

        {/* Loading message */}
        <Text style={styles.loadingText}>{message}</Text>

        {/* Tagline - matching SplashScreen */}
        <Text style={styles.tagline}>Hanap Traysikel? Traysikel KO!</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFF8F5', // Match SplashScreen background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#FFF8F5',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appNameContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: spacing.xl,
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
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  spinnerContainer: {
    marginVertical: spacing.lg,
  },
  loadingText: {
    fontSize: 16,
    color: '#1D1D1D',
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  tagline: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    fontWeight: '400',
    fontStyle: 'italic',
  },
});
