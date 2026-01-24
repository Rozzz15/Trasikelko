// Safety Service - Supabase
// Stores safety records, incidents, and complaints in database (like Grab/Angkas)
// Replaces AsyncStorage-based safetyStorage.ts

import { supabase } from '../config/supabase';
import { getUserTrips } from './tripService';

export type SafetyBadgeColor = 'green' | 'yellow' | 'red';

export interface SafetyRecord {
  id: string;
  user_id: string;
  driver_email: string;
  record_type: 'sos' | 'incident' | 'complaint';
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved' | 'dismissed';
  trip_id?: string;
  reported_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface DriverSafetyRecord {
  driverId: string;
  driverEmail: string;
  safetyBadge: SafetyBadgeColor;
  totalRides: number;
  averageRating: number;
  incidents: number;
  complaints: number;
  registrationDate: string;
  lastIncidentDate?: string;
}

/**
 * Calculate safety badge color based on driver record
 * Same logic as before but reads from Supabase
 */
export const calculateSafetyBadge = async (driverEmail: string): Promise<SafetyBadgeColor> => {
  try {
    // Get driver account
    const { getUserAccount } = require('../utils/userStorage');
    const account = await getUserAccount(driverEmail);
    if (!account || account.accountType !== 'driver') {
      return 'yellow'; // Default for non-drivers
    }

    // Get driver trips to calculate stats
    const { getCurrentUser } = require('../utils/sessionHelper');
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return 'yellow';
    }

    const result = await getUserTrips(user.id, 'driver');
    const trips = result.success ? result.trips || [] : [];
    const completedTrips = trips.filter((t: any) => t.status === 'completed');
    const totalRides = completedTrips.length;

    // Get incidents and complaints from database
    const incidents = await getDriverIncidents(user.id);
    const complaints = await getDriverComplaints(user.id);
    
    // Calculate average rating from passenger ratings
    const ratings = completedTrips
      .map((t: any) => t.passenger_rating)
      .filter((r: any): r is number => r !== undefined && r > 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length
      : 0;

    // Get registration date
    const registrationDate = account.submittedAt || account.verifiedAt || new Date().toISOString();
    const daysSinceRegistration = (Date.now() - new Date(registrationDate).getTime()) / (1000 * 60 * 60 * 24);

    // Safety badge logic (same as before)
    const recentIncidents = incidents.filter(i => {
      const daysSince = (Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    });

    const recentComplaints = complaints.filter(c => {
      const daysSince = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });

    const veryRecentIncidents = incidents.filter(i => {
      const daysSince = (Date.now() - new Date(i.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });

    // Determine badge color
    if (
      totalRides >= 50 &&
      averageRating >= 4.5 &&
      recentIncidents.length === 0 &&
      recentComplaints.length <= 1
    ) {
      return 'green';
    } else if (
      averageRating < 3.5 ||
      incidents.length > 2 ||
      complaints.length > 3 ||
      veryRecentIncidents.length > 0
    ) {
      return 'red';
    } else {
      return 'yellow';
    }
  } catch (error) {
    console.error('Error calculating safety badge:', error);
    return 'yellow';
  }
};

/**
 * Get driver safety record
 */
export const getDriverSafetyRecord = async (driverId: string): Promise<DriverSafetyRecord | null> => {
  try {
    const { getUserAccount } = require('../utils/userStorage');
    const account = await getUserAccount(driverId);
    if (!account || account.accountType !== 'driver') {
      return null;
    }

    const result = await getUserTrips(driverId, 'driver');
    const trips = result.success ? result.trips || [] : [];
    const completedTrips = trips.filter((t: any) => t.status === 'completed');

    const incidents = await getDriverIncidents(driverId);
    const complaints = await getDriverComplaints(driverId);

    const ratings = completedTrips
      .map((t: any) => t.passenger_rating)
      .filter((r: any): r is number => r !== undefined && r > 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length
      : 0;

    const safetyBadge = await calculateSafetyBadge(driverId);

    const lastIncident = incidents.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    return {
      driverId,
      driverEmail: driverId,
      safetyBadge,
      totalRides: completedTrips.length,
      averageRating,
      incidents: incidents.length,
      complaints: complaints.length,
      registrationDate: account.submittedAt || account.verifiedAt || new Date().toISOString(),
      lastIncidentDate: lastIncident?.created_at,
    };
  } catch (error) {
    console.error('Error getting driver safety record:', error);
    return null;
  }
};

/**
 * Report an incident
 */
export const reportIncident = async (
  userId: string,
  driverEmail: string,
  description: string,
  severity: 'low' | 'medium' | 'high',
  tripId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('safety_records')
      .insert({
        user_id: userId,
        record_type: 'incident',
        description,
        severity,
        status: 'pending',
        trip_id: tripId,
        reported_by: driverEmail,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Report a complaint
 */
export const reportComplaint = async (
  userId: string,
  driverEmail: string,
  passengerEmail: string,
  description: string,
  severity: 'low' | 'medium' | 'high',
  tripId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('safety_records')
      .insert({
        user_id: userId,
        record_type: 'complaint',
        description,
        severity,
        status: 'pending',
        trip_id: tripId,
        reported_by: passengerEmail,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get driver incidents
 */
export const getDriverIncidents = async (userId: string): Promise<SafetyRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('safety_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_type', 'incident')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting driver incidents:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting driver incidents:', error);
    return [];
  }
};

/**
 * Get driver complaints
 */
export const getDriverComplaints = async (userId: string): Promise<SafetyRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('safety_records')
      .select('*')
      .eq('user_id', userId)
      .eq('record_type', 'complaint')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting driver complaints:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting driver complaints:', error);
    return [];
  }
};

/**
 * Get all safety records for a driver
 */
export const getDriverSafetyRecords = async (userId: string): Promise<SafetyRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('safety_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting safety records:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting safety records:', error);
    return [];
  }
};

/**
 * Report SOS incident
 */
export const reportSOS = async (
  userId: string,
  userEmail: string,
  location: string,
  description: string,
  tripId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('safety_records')
      .insert({
        user_id: userId,
        record_type: 'sos',
        description: `SOS Alert at ${location}: ${description}`,
        severity: 'high',
        status: 'pending',
        trip_id: tripId,
        reported_by: userEmail,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
