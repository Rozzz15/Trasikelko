import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import {
  SplashScreen,
  CreateAccountScreen,
  LoginScreen,
  PassengerHomeScreen,
  DriverHomeScreen,
  TripHistoryScreen,
  ProfileScreen,
  SOSScreen,
  EnterDropoffScreen,
  ConfirmBookingScreen,
  SearchingDriverScreen,
  DriverFoundScreen,
  DuringRideScreen,
  EndOfRideScreen,
  AcceptedRideScreen,
  DuringRideDriverScreen,
  RideCompletedScreen,
  AdminDashboardScreen,
  ReportIssueScreen,
  EarningsSummaryScreen,
} from '../screens';
import { ScheduleRideScreen } from '../screens/ScheduleRideScreen';
import { ScheduleHistoryScreen } from '../screens/ScheduleHistoryScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { DiscountVerificationScreen } from '../screens/DiscountVerificationScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import type { PassengerFormData, DriverFormData } from '../screens/CreateAccountScreen';

export type RootStackParamList = {
  ForgotPassword: undefined;
  Splash: undefined;
  CreateAccount: undefined;
  Login: { email?: string; userType?: 'passenger' | 'driver' } | undefined;
  AdminDashboard: undefined;
  PassengerHome: undefined;
  DriverHome: undefined;
  PassengerTrips: undefined;
  DriverTrips: undefined;
  DriverEarnings: undefined;
  PassengerProfile: undefined;
  DriverProfile: undefined;
  DiscountVerification: undefined;
  SOS: undefined;
  EnterDropoff: { pickupLocation?: string; pickupCoordinates?: { latitude: number; longitude: number } };
  ConfirmBooking: {
    pickupLocation: string;
    dropoffLocation: string;
    pickupCoordinates?: { latitude: number; longitude: number };
    dropoffCoordinates?: { latitude: number; longitude: number };
    distance: number;
    fareEstimate: { min: number; max: number };
    eta: string;
    availableDrivers: number;
  };
  SearchingDriver: {
    pickupLocation: string;
    dropoffLocation: string;
    pickupCoordinates?: { latitude: number; longitude: number };
    dropoffCoordinates?: { latitude: number; longitude: number };
    distance: number;
    fareEstimate: { min: number; max: number };
    driver: any;
    bookingId?: string;
  };
  DriverFound: {
    pickupLocation: string;
    dropoffLocation: string;
    pickupCoordinates?: { latitude: number; longitude: number };
    dropoffCoordinates?: { latitude: number; longitude: number };
    distance: number;
    fareEstimate: { min: number; max: number };
    driver: any;
  };
  DuringRide: {
    pickupLocation: string;
    dropoffLocation: string;
    pickupCoordinates?: { latitude: number; longitude: number };
    dropoffCoordinates?: { latitude: number; longitude: number };
    driver: any;
    driverLocation?: { latitude: number; longitude: number };
  };
  EndOfRide: {
    pickupLocation: string;
    dropoffLocation: string;
    distance: number;
    fareEstimate: { min: number; max: number };
    duration?: number;
    driver: any;
  };
  AcceptedRide: {
    bookingId: string;
    passengerName: string;
    passengerPhone: string;
    pickupLocation: string;
    dropoffLocation: string;
    pickupCoordinates?: { latitude: number; longitude: number };
    dropoffCoordinates?: { latitude: number; longitude: number };
    fare: string;
    distance: string;
  };
  DuringRideDriver: {
    bookingId: string;
    passengerName: string;
    passengerPhone: string;
    pickupLocation: string;
    dropoffLocation: string;
    pickupCoordinates?: { latitude: number; longitude: number };
    dropoffCoordinates?: { latitude: number; longitude: number };
    driverLocation?: { latitude: number; longitude: number };
  };
  RideCompleted: {
    bookingId: string;
    passengerName: string;
    passengerPhone: string;
    pickupLocation: string;
    dropoffLocation: string;
    fare: string;
    distance: string;
    duration?: number;
  };
  ReportIssue: {
    driverEmail?: string;
    driverName?: string;
    tripId?: string;
  } | undefined;
  ScheduleHistory: undefined;
  ScheduleRide: undefined;
  Favorites: {
    userId?: string;
    returnTo?: string;
    useAs?: 'pickup' | 'dropoff';
  } | undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const [userType, setUserType] = useState<'passenger' | 'driver' | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigationRef = useRef<any>(null);
  const pendingNavigation = useRef<'passenger' | 'driver' | null>(null);
  const pendingLogout = useRef<boolean>(false);
  const pendingLogoutUserType = useRef<'passenger' | 'driver' | null>(null);

  // Check for existing session on app start
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        console.log('[AppNavigator] Checking for existing session...');
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('[AppNavigator] Session found for user:', session.user.email);
          
          // Check if user is admin
          const currentUserEmail = session.user.email?.toLowerCase();
          const adminEmail = process.env.EXPO_PUBLIC_ADMIN_EMAIL?.toLowerCase();
          
          if (currentUserEmail === adminEmail) {
            console.log('[AppNavigator] Admin session detected');
            // Admin goes to dashboard, not passenger/driver home
            setIsCheckingSession(false);
            return;
          }
          
          // Get user account type from database
          const { data: userData, error } = await supabase
            .from('users')
            .select('account_type')
            .eq('id', session.user.id)
            .single();
          
          if (userData && !error) {
            const accountType = userData.account_type as 'passenger' | 'driver';
            console.log('[AppNavigator] User type:', accountType);
            
            // Store email for profile access
            await AsyncStorage.setItem('current_user_email', session.user.email || '');
            
            // Set user type and navigate
            setUserType(accountType);
            pendingNavigation.current = accountType;
          } else {
            console.error('[AppNavigator] Failed to get user data:', error);
            console.log('[AppNavigator] User deleted from database, signing out...');
            
            // User was deleted from database but session still exists
            // Sign out to clear the orphaned session
            await supabase.auth.signOut();
            await AsyncStorage.removeItem('current_user_email');
            setUserType(null);
          }
        } else {
          console.log('[AppNavigator] No existing session found');
        }
      } catch (error) {
        console.error('[AppNavigator] Error checking session:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkExistingSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[AppNavigator] Auth state changed:', _event);
      
      if (_event === 'SIGNED_OUT') {
        setUserType(null);
        pendingLogout.current = true;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUserTypeSelect = (type: 'passenger' | 'driver') => {
    setUserType(type);
  };

  const handleAccountCreated = async (type: 'passenger' | 'driver', email?: string) => {
    console.log('Account created, setting up user session...');
    
    // Store current user email for profile access
    if (email) {
      try {
        await AsyncStorage.setItem('current_user_email', email.toLowerCase());
        console.log('Stored user email:', email);
      } catch (error) {
        console.error('Error storing current user email:', error);
      }
    }
    
    // Set user type and trigger navigation
    setUserType(type);
    pendingNavigation.current = type;
    console.log('User type set to:', type);
  };

  const handleLogin = async (email: string, password: string, type: 'passenger' | 'driver') => {
    console.log(`${type} login:`, email);
    setUserType(type);
    pendingNavigation.current = type;
    // Store current user email for profile access
    try {
      await AsyncStorage.setItem('current_user_email', email.toLowerCase());
    } catch (error) {
      console.error('Error storing current user email:', error);
    }
  };

  const handleLogout = async () => {
    const previousUserType = userType; // Store user type before clearing
    
    try {
      console.log('[AppNavigator] Logging out...');
      
      // Clear stored user data
      await AsyncStorage.removeItem('current_user_email');
      await AsyncStorage.removeItem('active_trip');
      
      // Sign out from Supabase Auth
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[AppNavigator] Error signing out from Supabase:', error);
      } else {
        console.log('[AppNavigator] Successfully signed out from Supabase');
      }
    } catch (error) {
      console.error('[AppNavigator] Error during logout:', error);
    }
    
    // Reset to login screen
    setUserType(null);
    setActiveTab('home');
    
    // Navigate to Login screen immediately
    if (navigationRef.current) {
      console.log('[AppNavigator] Navigating to Login screen after logout');
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
    
    pendingNavigation.current = null;
    pendingLogout.current = true;
    pendingLogoutUserType.current = previousUserType; // Store for navigation
  };

  // Handle navigation after userType state updates
  useEffect(() => {
    if (pendingNavigation.current && navigationRef.current) {
      const type = pendingNavigation.current;
      setTimeout(() => {
        if (type === 'passenger') {
          navigationRef.current?.reset({
            index: 0,
            routes: [{ name: 'PassengerHome' }],
          });
        } else if (type === 'driver') {
          navigationRef.current?.reset({
            index: 0,
            routes: [{ name: 'DriverHome' }],
          });
        }
        pendingNavigation.current = null;
      }, 100);
    }
  }, [userType]);

  // Handle logout navigation after userType is set to null and screens are re-registered
  // No longer need to manually navigate - the navigation structure rebuilds automatically
  useEffect(() => {
    if (pendingLogout.current && !userType) {
      // Just reset the pending logout flag
      // The NavigationContainer will automatically show the correct initial screen
      pendingLogout.current = false;
      pendingLogoutUserType.current = null;
    }
  }, [userType]);

  // Show splash while checking session
  if (isCheckingSession) {
    return (
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#FFF8F5' },
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#FFF8F5' },
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        
        {/* Auth screens - always available */}
        <Stack.Screen name="Login">
          {(props) => (
            <LoginScreen
              {...props}
              onLogin={(email, password, userType) => {
                handleLogin(email, password, userType);
              }}
              onForgotPassword={() => {
                props.navigation.navigate('ForgotPassword');
              }}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="ForgotPassword">
          {(props) => (
            <ForgotPasswordScreen
              {...props}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="CreateAccount">
          {(props) => (
            <CreateAccountScreen
              {...props}
              onSubmit={async (data: PassengerFormData | DriverFormData, accountType: 'passenger' | 'driver') => {
                console.log(`${accountType} account created:`, data);
                const email = accountType === 'passenger' 
                  ? (data as PassengerFormData).email 
                  : (data as DriverFormData).email;
                await handleAccountCreated(accountType, email);
              }}
              onBack={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="AdminDashboard">
          {(props) => (
            <AdminDashboardScreen
              {...props}
              onLogout={() => {
                handleLogout();
              }}
            />
          )}
        </Stack.Screen>
        
        {/* User-specific screens */}
        {userType && (
          <>
            {userType === 'passenger' ? (
              <>
                <Stack.Screen name="PassengerHome">
                  {(props) => (
                    <PassengerHomeScreen
                      {...props}
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        if (tab === 'trips') {
                          props.navigation.navigate('PassengerTrips');
                        } else if (tab === 'profile') {
                          props.navigation.navigate('PassengerProfile');
                        } else {
                          props.navigation.navigate('PassengerHome');
                        }
                      }}
                      onSOSPress={() => props.navigation.navigate('SOS')}
                    />
                  )}
                </Stack.Screen>

                <Stack.Screen name="PassengerTrips">
                  {(props) => (
                    <TripHistoryScreen
                      {...props}
                      userType="passenger"
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        if (tab === 'home') {
                          props.navigation.navigate('PassengerHome');
                        } else if (tab === 'profile') {
                          props.navigation.navigate('PassengerProfile');
                        } else {
                          props.navigation.navigate('PassengerTrips');
                        }
                      }}
                    />
                  )}
                </Stack.Screen>

                <Stack.Screen name="PassengerProfile">
                  {(props) => (
                    <ProfileScreen
                      {...props}
                      userType="passenger"
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        if (tab === 'home') {
                          props.navigation.navigate('PassengerHome');
                        } else if (tab === 'trips') {
                          props.navigation.navigate('PassengerTrips');
                        } else {
                          props.navigation.navigate('PassengerProfile');
                        }
                      }}
                      onSOSPress={() => props.navigation.navigate('SOS')}
                      onLogout={() => {
                        handleLogout();
                      }}
                    />
                  )}
                </Stack.Screen>
              </>
            ) : (
              <>
                <Stack.Screen name="DriverHome">
                  {(props) => (
                    <DriverHomeScreen
                      {...props}
                      navigation={props.navigation}
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        if (tab === 'trips') {
                          props.navigation.navigate('DriverTrips');
                        } else if (tab === 'profile') {
                          props.navigation.navigate('DriverProfile');
                        } else {
                          props.navigation.navigate('DriverHome');
                        }
                      }}
                      onSOSPress={() => props.navigation.navigate('SOS')}
                      onLogout={() => {
                        handleLogout();
                      }}
                    />
                  )}
                </Stack.Screen>

                <Stack.Screen name="DriverTrips">
                  {(props) => (
                    <TripHistoryScreen
                      {...props}
                      userType="driver"
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        if (tab === 'home') {
                          props.navigation.navigate('DriverHome');
                        } else if (tab === 'profile') {
                          props.navigation.navigate('DriverProfile');
                        } else {
                          props.navigation.navigate('DriverTrips');
                        }
                      }}
                    />
                  )}
                </Stack.Screen>

                <Stack.Screen name="DriverEarnings">
                  {(props) => (
                    <EarningsSummaryScreen
                      {...props}
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        if (tab === 'home') {
                          props.navigation.navigate('DriverHome');
                        } else if (tab === 'trips') {
                          props.navigation.navigate('DriverTrips');
                        } else if (tab === 'profile') {
                          props.navigation.navigate('DriverProfile');
                        }
                      }}
                    />
                  )}
                </Stack.Screen>

                <Stack.Screen name="DriverProfile">
                  {(props) => (
                    <ProfileScreen
                      {...props}
                      userType="driver"
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        if (tab === 'home') {
                          props.navigation.navigate('DriverHome');
                        } else if (tab === 'trips') {
                          props.navigation.navigate('DriverTrips');
                        } else {
                          props.navigation.navigate('DriverProfile');
                        }
                      }}
                      onSOSPress={() => props.navigation.navigate('SOS')}
                      onLogout={() => {
                        handleLogout();
                      }}
                    />
                  )}
                </Stack.Screen>
              </>
            )}

            <Stack.Screen name="SOS">
              {(props) => (
                <SOSScreen
                  {...props}
                  onBack={() => props.navigation.goBack()}
                />
              )}
            </Stack.Screen>

            {/* Passenger Booking Flow Screens */}
            {userType === 'passenger' && (
              <>
                <Stack.Screen name="EnterDropoff" component={EnterDropoffScreen} />
                <Stack.Screen name="ConfirmBooking" component={ConfirmBookingScreen} />
                <Stack.Screen name="SearchingDriver" component={SearchingDriverScreen} />
                <Stack.Screen name="DriverFound" component={DriverFoundScreen} />
                <Stack.Screen name="DuringRide" component={DuringRideScreen} />
                <Stack.Screen name="EndOfRide" component={EndOfRideScreen} />
                <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
                <Stack.Screen name="ScheduleHistory" component={ScheduleHistoryScreen} />
                <Stack.Screen name="ScheduleRide" component={ScheduleRideScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="DiscountVerification" component={DiscountVerificationScreen} />
              </>
            )}

            {/* Driver Ride Flow Screens */}
            {userType === 'driver' && (
              <>
                <Stack.Screen name="AcceptedRide" component={AcceptedRideScreen} />
                <Stack.Screen name="DuringRideDriver" component={DuringRideDriverScreen} />
                <Stack.Screen name="RideCompleted" component={RideCompletedScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
