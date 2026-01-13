import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
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
import type { PassengerFormData, DriverFormData } from '../screens/CreateAccountScreen';

export type RootStackParamList = {
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
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const [userType, setUserType] = useState<'passenger' | 'driver' | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const navigationRef = useRef<any>(null);
  const pendingNavigation = useRef<'passenger' | 'driver' | null>(null);
  const pendingLogout = useRef<boolean>(false);
  const pendingLogoutUserType = useRef<'passenger' | 'driver' | null>(null);

  const handleUserTypeSelect = (type: 'passenger' | 'driver') => {
    setUserType(type);
  };

  const handleAccountCreated = async (type: 'passenger' | 'driver', email?: string) => {
    setUserType(type);
    pendingNavigation.current = type;
    // Store current user email for profile access
    if (email) {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('current_user_email', email.toLowerCase());
      } catch (error) {
        console.error('Error storing current user email:', error);
      }
    }
  };

  const handleLogin = async (email: string, password: string, type: 'passenger' | 'driver') => {
    console.log(`${type} login:`, email);
    setUserType(type);
    pendingNavigation.current = type;
    // Store current user email for profile access
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('current_user_email', email.toLowerCase());
    } catch (error) {
      console.error('Error storing current user email:', error);
    }
  };

  const handleLogout = async () => {
    const previousUserType = userType; // Store user type before clearing
    
    // Clear stored user data
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem('current_user_email');
      // Optionally clear active trip
      await AsyncStorage.removeItem('active_trip');
    } catch (error) {
      console.error('Error clearing user data on logout:', error);
    }
    
    setUserType(null);
    setActiveTab('home');
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
  useEffect(() => {
    if (pendingLogout.current && !userType && navigationRef.current) {
      setTimeout(() => {
        // Navigate to Login screen after logout
        navigationRef.current?.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
        pendingLogout.current = false;
        pendingLogoutUserType.current = null;
      }, 100);
    }
  }, [userType]);

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
        
        {!userType ? (
          <>
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen
                  {...props}
                  onLogin={(email, password, userType) => {
                    handleLogin(email, password, userType);
                  }}
                  onForgotPassword={() => {
                    // Handle forgot password
                  }}
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
          </>
        ) : (
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
