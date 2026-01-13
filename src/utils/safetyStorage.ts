import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTripsByUserId } from './tripStorage';

export type SafetyBadgeColor = 'green' | 'yellow' | 'red';

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

const SAFETY_RECORDS_KEY = 'driver_safety_records';
const INCIDENTS_KEY = 'driver_incidents';
const COMPLAINTS_KEY = 'driver_complaints';

// Calculate safety badge color based on driver record
export const calculateSafetyBadge = async (driverEmail: string): Promise<SafetyBadgeColor> => {
  try {
    const account = await import('./userStorage').then(m => m.getUserAccount(driverEmail));
    if (!account || account.accountType !== 'driver') {
      return 'yellow'; // Default for non-drivers
    }

    // Get driver trips to calculate stats
    const trips = await getTripsByUserId(driverEmail, 'driver');
    const completedTrips = trips.filter(t => t.status === 'completed');
    const totalRides = completedTrips.length;

    // Get incidents and complaints
    const incidents = await getDriverIncidents(driverEmail);
    const complaints = await getDriverComplaints(driverEmail);
    
    // Calculate average rating from passenger ratings (passengerRating = rating BY passenger TO driver)
    // passengerRating is the rating passengers give to drivers, which represents the driver's performance
    const ratings = completedTrips
      .map(t => t.passengerRating)
      .filter((r): r is number => r !== undefined && r > 0);
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : 0;

    // Get registration date
    const registrationDate = account.submittedAt || account.verifiedAt || new Date().toISOString();
    const daysSinceRegistration = (Date.now() - new Date(registrationDate).getTime()) / (1000 * 60 * 60 * 24);

    // Safety badge logic:
    // Green: Excellent safety record
    //   - At least 50 rides
    //   - Average rating >= 4.5
    //   - No incidents in last 90 days
    //   - No more than 1 complaint in last 30 days
    // Yellow: Newly registered driver
    //   - Less than 20 rides OR registered less than 30 days ago
    // Red: Has recorded issues
    //   - Average rating < 3.5 OR
    //   - More than 2 incidents OR
    //   - More than 3 complaints OR
    //   - Incident in last 30 days

    const recentIncidents = incidents.filter(i => {
      const daysSince = (Date.now() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    });

    const recentComplaints = complaints.filter(c => {
      const daysSince = (Date.now() - new Date(c.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });

    const veryRecentIncidents = incidents.filter(i => {
      const daysSince = (Date.now() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });

    // Red badge conditions
    if (
      averageRating < 3.5 ||
      incidents.length > 2 ||
      complaints.length > 3 ||
      veryRecentIncidents.length > 0
    ) {
      return 'red';
    }

    // Yellow badge conditions (new driver)
    if (totalRides < 20 || daysSinceRegistration < 30) {
      return 'yellow';
    }

    // Green badge conditions (excellent record)
    if (
      totalRides >= 50 &&
      averageRating >= 4.5 &&
      recentIncidents.length === 0 &&
      recentComplaints.length <= 1
    ) {
      return 'green';
    }

    // Default to yellow if conditions don't match
    return 'yellow';
  } catch (error) {
    console.error('Error calculating safety badge:', error);
    return 'yellow';
  }
};

// Get or create safety record for driver
export const getDriverSafetyRecord = async (driverEmail: string): Promise<DriverSafetyRecord> => {
  try {
    const records = await getSafetyRecords();
    let record = records.find(r => r.driverEmail === driverEmail);

    if (!record) {
      // Create new record
      const badge = await calculateSafetyBadge(driverEmail);
      const trips = await getTripsByUserId(driverEmail, 'driver');
      const completedTrips = trips.filter(t => t.status === 'completed');
      
      const ratings = completedTrips
        .map(t => t.passengerRating)
        .filter((r): r is number => r !== undefined && r > 0);
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      const account = await import('./userStorage').then(m => m.getUserAccount(driverEmail));
      const registrationDate = account?.submittedAt || account?.verifiedAt || new Date().toISOString();

      record = {
        driverId: driverEmail,
        driverEmail,
        safetyBadge: badge,
        totalRides: completedTrips.length,
        averageRating,
        incidents: 0,
        complaints: 0,
        registrationDate,
      };

      records.push(record);
      await AsyncStorage.setItem(SAFETY_RECORDS_KEY, JSON.stringify(records));
    } else {
      // Update existing record
      const badge = await calculateSafetyBadge(driverEmail);
      const trips = await getTripsByUserId(driverEmail, 'driver');
      const completedTrips = trips.filter(t => t.status === 'completed');
      
      const ratings = completedTrips
        .map(t => t.passengerRating)
        .filter((r): r is number => r !== undefined && r > 0);
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0;

      const incidents = await getDriverIncidents(driverEmail);
      const complaints = await getDriverComplaints(driverEmail);

      record = {
        ...record,
        safetyBadge: badge,
        totalRides: completedTrips.length,
        averageRating,
        incidents: incidents.length,
        complaints: complaints.length,
        lastIncidentDate: incidents.length > 0 ? incidents[incidents.length - 1].date : undefined,
      };

      // Update in storage
      const records = await getSafetyRecords();
      const index = records.findIndex(r => r.driverEmail === driverEmail);
      if (index >= 0) {
        records[index] = record;
        await AsyncStorage.setItem(SAFETY_RECORDS_KEY, JSON.stringify(records));
      }
    }

    return record;
  } catch (error) {
    console.error('Error getting driver safety record:', error);
    throw error;
  }
};

// Get all safety records
const getSafetyRecords = async (): Promise<DriverSafetyRecord[]> => {
  try {
    const data = await AsyncStorage.getItem(SAFETY_RECORDS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting safety records:', error);
    return [];
  }
};

// Report an incident
export interface Incident {
  id: string;
  driverEmail: string;
  date: string;
  type: 'accident' | 'violation' | 'misconduct' | 'other';
  description: string;
  reportedBy: string;
  severity: 'low' | 'medium' | 'high';
}

export const reportIncident = async (incident: Omit<Incident, 'id'>): Promise<void> => {
  try {
    const incidents = await getAllIncidents();
    const newIncident: Incident = {
      ...incident,
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    incidents.push(newIncident);
    await AsyncStorage.setItem(INCIDENTS_KEY, JSON.stringify(incidents));

    // Update safety record
    await getDriverSafetyRecord(incident.driverEmail);
  } catch (error) {
    console.error('Error reporting incident:', error);
    throw error;
  }
};

// Get incidents for a driver
export const getDriverIncidents = async (driverEmail: string): Promise<Incident[]> => {
  try {
    const incidents = await getAllIncidents();
    return incidents.filter(i => i.driverEmail === driverEmail);
  } catch (error) {
    console.error('Error getting driver incidents:', error);
    return [];
  }
};

// Get all incidents
const getAllIncidents = async (): Promise<Incident[]> => {
  try {
    const data = await AsyncStorage.getItem(INCIDENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting incidents:', error);
    return [];
  }
};

// Report a complaint
export interface Complaint {
  id: string;
  driverEmail: string;
  date: string;
  type: 'overcharging' | 'rude_behavior' | 'unsafe_driving' | 'vehicle_condition' | 'other';
  description: string;
  reportedBy: string;
  tripId?: string;
}

export const reportComplaint = async (complaint: Omit<Complaint, 'id'>): Promise<void> => {
  try {
    const complaints = await getAllComplaints();
    const newComplaint: Complaint = {
      ...complaint,
      id: `complaint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    complaints.push(newComplaint);
    await AsyncStorage.setItem(COMPLAINTS_KEY, JSON.stringify(complaints));

    // Update safety record
    await getDriverSafetyRecord(complaint.driverEmail);
  } catch (error) {
    console.error('Error reporting complaint:', error);
    throw error;
  }
};

// Get complaints for a driver
export const getDriverComplaints = async (driverEmail: string): Promise<Complaint[]> => {
  try {
    const complaints = await getAllComplaints();
    return complaints.filter(c => c.driverEmail === driverEmail);
  } catch (error) {
    console.error('Error getting driver complaints:', error);
    return [];
  }
};

// Get all complaints
const getAllComplaints = async (): Promise<Complaint[]> => {
  try {
    const data = await AsyncStorage.getItem(COMPLAINTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting complaints:', error);
    return [];
  }
};










