import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoadingScreen } from './src/components/LoadingScreen';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate app initialization (loading fonts, checking auth, etc.)
    const initializeApp = async () => {
      try {
        // Add any initialization logic here:
        // - Load fonts
        // - Check authentication status
        // - Load cached data
        // - Initialize services
        
        // Simulate loading time (minimum 2 seconds to show the loading screen)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Initializing Traysikel KO..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFF8F5' }}>
      <StatusBar style="auto" />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
