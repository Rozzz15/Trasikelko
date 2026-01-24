// Push Notification Service
// Handles push notifications for ride requests, updates, and alerts
// Uses Expo Notifications

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import Logger from '../utils/logger';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  platform: 'ios' | 'android';
  userId: string;
}

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Logger.warn('[Notifications] Permission not granted');
      return false;
    }

    Logger.success('[Notifications] Permission granted');
    return true;
  } catch (error) {
    Logger.error('[Notifications] Error requesting permissions:', error);
    return false;
  }
};

/**
 * Get the Expo Push Token for this device
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    // Check if running on physical device
    if (!__DEV__ && Platform.OS === 'android') {
      // For Android, you need to configure Firebase
      Logger.warn('[Notifications] Android requires Firebase configuration');
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id', // Replace with your Expo project ID
    });

    Logger.success('[Notifications] Expo push token obtained:', token.data);
    return token.data;
  } catch (error) {
    Logger.error('[Notifications] Error getting push token:', error);
    return null;
  }
};

/**
 * Register device token with Supabase
 */
export const registerPushToken = async (
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    // Store token in database
    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token: token,
        platform: platform,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      Logger.error('[Notifications] Error saving token:', error);
      return { success: false, error: error.message };
    }

    Logger.success('[Notifications] Push token registered for user:', userId);
    return { success: true };
  } catch (error: any) {
    Logger.error('[Notifications] Error registering token:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Initialize notifications for a user
 */
export const initializeNotifications = async (userId: string): Promise<boolean> => {
  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    // Get push token
    const token = await getExpoPushToken();
    if (!token) {
      return false;
    }

    // Register token with backend
    const result = await registerPushToken(userId, token);
    return result.success;
  } catch (error) {
    Logger.error('[Notifications] Error initializing notifications:', error);
    return false;
  }
};

/**
 * Send a local notification (for testing)
 */
export const sendLocalNotification = async (
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    Logger.error('[Notifications] Error sending local notification:', error);
  }
};

/**
 * Send notification to specific user (via Supabase Edge Function)
 */
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get user's push token from database
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      Logger.warn('[Notifications] No push token found for user:', userId);
      return { success: false, error: 'No push token found' };
    }

    // Send notification via Expo Push API
    const message = {
      to: tokenData.token,
      sound: 'default',
      title,
      body,
      data,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data?.status === 'error') {
      Logger.error('[Notifications] Error sending notification:', result.data);
      return { success: false, error: result.data.message };
    }

    Logger.success('[Notifications] Notification sent to user:', userId);
    return { success: true };
  } catch (error: any) {
    Logger.error('[Notifications] Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to multiple users
 */
export const sendBulkNotifications = async (
  userIds: string[],
  title: string,
  body: string,
  data?: any
): Promise<{ success: boolean; successCount: number; failCount: number }> => {
  let successCount = 0;
  let failCount = 0;

  for (const userId of userIds) {
    const result = await sendPushNotification(userId, title, body, data);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  Logger.info(`[Notifications] Sent ${successCount}/${userIds.length} notifications`);
  return { success: successCount > 0, successCount, failCount };
};

/**
 * Notify driver about new ride request
 */
export const notifyDriverAboutRide = async (
  driverId: string,
  passengerName: string,
  pickupLocation: string,
  tripId: string
): Promise<{ success: boolean; error?: string }> => {
  return sendPushNotification(
    driverId,
    '🚖 New Ride Request',
    `${passengerName} needs a ride from ${pickupLocation}`,
    {
      type: 'ride_request',
      tripId,
      action: 'view_ride',
    }
  );
};

/**
 * Notify passenger that driver accepted
 */
export const notifyPassengerDriverAccepted = async (
  passengerId: string,
  driverName: string,
  estimatedArrival: string
): Promise<{ success: boolean; error?: string }> => {
  return sendPushNotification(
    passengerId,
    '✅ Driver Accepted!',
    `${driverName} is on the way. Arriving in ${estimatedArrival}`,
    {
      type: 'driver_accepted',
      action: 'view_ride',
    }
  );
};

/**
 * Notify passenger that driver has arrived
 */
export const notifyPassengerDriverArrived = async (
  passengerId: string,
  driverName: string
): Promise<{ success: boolean; error?: string }> => {
  return sendPushNotification(
    passengerId,
    '🎯 Driver Arrived!',
    `${driverName} has arrived at your pickup location`,
    {
      type: 'driver_arrived',
      action: 'view_ride',
    }
  );
};

/**
 * Notify about trip completion
 */
export const notifyTripCompleted = async (
  userId: string,
  fare: number
): Promise<{ success: boolean; error?: string }> => {
  return sendPushNotification(
    userId,
    '🏁 Trip Completed',
    `Your trip has been completed. Fare: ₱${fare}`,
    {
      type: 'trip_completed',
      action: 'rate_ride',
    }
  );
};

/**
 * Setup notification listeners
 */
export const setupNotificationListeners = (
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) => {
  // Listener for when notification is received while app is foregrounded
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    Logger.log('[Notifications] Received:', notification);
    onNotificationReceived?.(notification);
  });

  // Listener for when user taps on notification
  const tappedListener = Notifications.addNotificationResponseReceivedListener((response) => {
    Logger.log('[Notifications] Tapped:', response);
    onNotificationTapped?.(response);
  });

  // Return cleanup function
  return () => {
    receivedListener.remove();
    tappedListener.remove();
  };
};

/**
 * Clear all notifications
 */
export const clearAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    Logger.success('[Notifications] All notifications cleared');
  } catch (error) {
    Logger.error('[Notifications] Error clearing notifications:', error);
  }
};

/**
 * Get notification badge count
 */
export const getBadgeCount = async (): Promise<number> => {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    Logger.error('[Notifications] Error getting badge count:', error);
    return 0;
  }
};

/**
 * Set notification badge count
 */
export const setBadgeCount = async (count: number): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    Logger.error('[Notifications] Error setting badge count:', error);
  }
};
