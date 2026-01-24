import { supabase } from '../config/supabase';

export interface PendingDriver {
  email: string;
  fullName: string;
  phoneNumber: string;
  submittedAt: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;  // Mapped from full_name
  phoneNumber: string;  // Mapped from phone_number
  accountType: 'passenger' | 'driver';  // Mapped from account_type
  profilePhoto?: string;  // Mapped from profile_photo_url
  createdAt: string;  // Mapped from created_at
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  submittedAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  // Driver-specific fields
  driversLicenseNumber?: string;
  licenseExpiryDate?: string;
  licenseFrontPhoto?: string;
  licenseBackPhoto?: string;
  plateNumber?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  orcrPhoto?: string;
  franchiseNumber?: string;
  address?: string;
  // Passenger-specific discount fields
  discountType?: 'none' | 'senior' | 'pwd';
  discountVerificationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  seniorIdPhoto?: string;
  pwdIdPhoto?: string;
  discountRequestedAt?: string;
  discountVerifiedAt?: string;
  discountRejectionReason?: string;
}

// Get all pending driver applications from database
export const getPendingDrivers = async (): Promise<UserAccount[]> => {
  try {
    // Get admin user IDs to exclude
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('id');
    
    const adminUserIds = adminUsers?.map(admin => admin.id) || [];

    // Query users table joined with drivers table (exclude admins)
    let query = supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        phone_number,
        account_type,
        profile_photo_url,
        created_at,
        drivers (
          verification_status,
          submitted_at,
          verified_at,
          rejected_at,
          rejection_reason,
          drivers_license_number,
          license_expiry_date,
          license_front_photo_url,
          license_back_photo_url,
          plate_number,
          vehicle_model,
          vehicle_color,
          orcr_photo_url,
          franchise_number,
          address
        )
      `)
      .eq('account_type', 'driver')
      .order('created_at', { ascending: false });

    // Exclude admin users if any exist
    if (adminUserIds.length > 0) {
      query = query.not('id', 'in', `(${adminUserIds.join(',')})`);
    }

    const { data: drivers, error } = await query;

    if (error) {
      console.error('Error getting pending drivers:', error);
      return [];
    }

    // Transform to UserAccount format (map snake_case to camelCase)
    return (drivers || []).map((driver: any) => {
      // Fix: drivers can be an object or array depending on Supabase query
      const driverData = Array.isArray(driver.drivers) ? driver.drivers?.[0] : driver.drivers;
      return {
        id: driver.id,
        email: driver.email,
        fullName: driver.full_name,
        phoneNumber: driver.phone_number,
        accountType: driver.account_type,
        profilePhoto: driver.profile_photo_url,
        createdAt: driver.created_at,
        verificationStatus: driverData?.verification_status || 'pending',
        submittedAt: driverData?.submitted_at || driver.created_at,
        verifiedAt: driverData?.verified_at,
        rejectedAt: driverData?.rejected_at,
        rejectionReason: driverData?.rejection_reason,
        // Driver-specific fields
        driversLicenseNumber: driverData?.drivers_license_number,
        licenseExpiryDate: driverData?.license_expiry_date,
        licenseFrontPhoto: driverData?.license_front_photo_url,
        licenseBackPhoto: driverData?.license_back_photo_url,
        plateNumber: driverData?.plate_number,
        vehicleModel: driverData?.vehicle_model,
        vehicleColor: driverData?.vehicle_color,
        orcrPhoto: driverData?.orcr_photo_url,
        franchiseNumber: driverData?.franchise_number,
        address: driverData?.address,
      };
    });
  } catch (error) {
    console.error('Error getting pending drivers:', error);
    return [];
  }
};

// Approve a driver in database
export const approveDriver = async (email: string): Promise<void> => {
  try {
    console.log('[approveDriver] Starting approval process for:', email);
    
    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('[approveDriver] User not found:', userError);
      throw new Error('User not found');
    }

    console.log('[approveDriver] Found user ID:', user.id);

    // Update driver verification status
    const { data: updateData, error: updateError } = await supabase
      .from('drivers')
      .update({
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
        rejected_at: null, // Clear rejection timestamp
        rejection_reason: null, // Clear rejection reason
      })
      .eq('user_id', user.id)
      .select();

    if (updateError) {
      console.error('[approveDriver] Update error:', updateError);
      throw updateError;
    }

    console.log('[approveDriver] Successfully approved driver:', updateData);
  } catch (error) {
    console.error('[approveDriver] Error approving driver:', error);
    throw error;
  }
};

// Reject a driver in database
export const rejectDriver = async (email: string, reason?: string): Promise<void> => {
  try {
    console.log('[rejectDriver] Starting rejection process for:', email);
    
    // Get user ID from email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('[rejectDriver] User not found:', userError);
      throw new Error('User not found');
    }

    console.log('[rejectDriver] Found user ID:', user.id);

    // Update driver verification status
    const { data: updateData, error: updateError } = await supabase
      .from('drivers')
      .update({
        verification_status: 'rejected',
        rejection_reason: reason || 'Rejected by admin',
        rejected_at: new Date().toISOString(),
        verified_at: null, // Clear verification timestamp
      })
      .eq('user_id', user.id)
      .select();

    if (updateError) {
      console.error('[rejectDriver] Update error:', updateError);
      throw updateError;
    }

    console.log('[rejectDriver] Successfully rejected driver:', updateData);
  } catch (error) {
    console.error('[rejectDriver] Error rejecting driver:', error);
    throw error;
  }
};

// Get all users (passengers and drivers) from database
export const getAllUsers = async (): Promise<UserAccount[]> => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        phone_number,
        account_type,
        profile_photo_url,
        created_at,
        drivers (
          verification_status,
          submitted_at,
          verified_at,
          rejected_at,
          rejection_reason,
          drivers_license_number,
          license_expiry_date,
          license_front_photo_url,
          license_back_photo_url,
          plate_number,
          vehicle_model,
          vehicle_color,
          orcr_photo_url,
          franchise_number,
          address
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getAllUsers] Error getting all users:', error);
      return [];
    }

    console.log('[getAllUsers] Raw data from database:', JSON.stringify(users, null, 2));

    // Transform to UserAccount format (map snake_case to camelCase)
    return (users || []).map((user: any) => {
      // Fix: drivers is an object, not an array!
      const driverData = Array.isArray(user.drivers) ? user.drivers?.[0] : user.drivers;
      
      // Debug logging for drivers
      if (user.account_type === 'driver') {
        console.log(`[getAllUsers] Processing driver: ${user.email}`);
        console.log(`[getAllUsers] - profile_photo_url from DB:`, user.profile_photo_url);
        console.log(`[getAllUsers] - drivers data:`, user.drivers);
        console.log(`[getAllUsers] - driverData extracted:`, driverData);
        console.log(`[getAllUsers] - license_front_photo_url:`, driverData?.license_front_photo_url);
      }

      const mappedUser = {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phoneNumber: user.phone_number,
        accountType: user.account_type,
        account_type: user.account_type, // Keep both for compatibility
        profilePhoto: user.profile_photo_url,
        createdAt: user.created_at,
        verificationStatus: driverData?.verification_status || 'pending',
        submittedAt: driverData?.submitted_at || user.created_at,
        verifiedAt: driverData?.verified_at,
        rejectedAt: driverData?.rejected_at,
        rejectionReason: driverData?.rejection_reason,
        // Driver-specific fields
        driversLicenseNumber: driverData?.drivers_license_number,
        licenseExpiryDate: driverData?.license_expiry_date,
        licenseFrontPhoto: driverData?.license_front_photo_url,
        licenseBackPhoto: driverData?.license_back_photo_url,
        plateNumber: driverData?.plate_number,
        vehicleModel: driverData?.vehicle_model,
        vehicleColor: driverData?.vehicle_color,
        orcrPhoto: driverData?.orcr_photo_url,
        franchiseNumber: driverData?.franchise_number,
        address: driverData?.address,
      };

      if (user.account_type === 'driver') {
        console.log(`[getAllUsers] Mapped user for ${user.email}:`);
        console.log(`  - profilePhoto: ${mappedUser.profilePhoto}`);
        console.log(`  - licenseFrontPhoto: ${mappedUser.licenseFrontPhoto}`);
      }

      return mappedUser;
    });
  } catch (error) {
    console.error('[getAllUsers] Error getting all users:', error);
    return [];
  }
};

// Get all passengers with discount verification data
export const getAllPassengers = async (): Promise<UserAccount[]> => {
  try {
    const { data: passengers, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        full_name,
        phone_number,
        account_type,
        profile_photo_url,
        created_at,
        passengers (
          discount_type,
          discount_verification_status,
          senior_id_photo,
          pwd_id_photo,
          discount_requested_at,
          discount_verified_at,
          discount_rejection_reason
        )
      `)
      .eq('account_type', 'passenger')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getAllPassengers] Error getting passengers:', error);
      return [];
    }

    // Transform to UserAccount format with discount data
    return (passengers || []).map((passenger: any) => {
      const passengerData = Array.isArray(passenger.passengers) ? passenger.passengers?.[0] : passenger.passengers;
      
      return {
        id: passenger.id,
        email: passenger.email,
        fullName: passenger.full_name,
        phoneNumber: passenger.phone_number,
        accountType: passenger.account_type,
        profilePhoto: passenger.profile_photo_url,
        createdAt: passenger.created_at,
        // Discount verification fields
        discountType: passengerData?.discount_type || 'none',
        discountVerificationStatus: passengerData?.discount_verification_status || 'none',
        seniorIdPhoto: passengerData?.senior_id_photo,
        pwdIdPhoto: passengerData?.pwd_id_photo,
        discountRequestedAt: passengerData?.discount_requested_at,
        discountVerifiedAt: passengerData?.discount_verified_at,
        discountRejectionReason: passengerData?.discount_rejection_reason,
      };
    });
  } catch (error) {
    console.error('[getAllPassengers] Error getting passengers:', error);
    return [];
  }
};

// Get all drivers
export const getAllDrivers = async (): Promise<UserAccount[]> => {
  try {
    // Get admin user IDs to exclude
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('id');
    
    const adminUserIds = adminUsers?.map(admin => admin.id) || [];

    const allUsers = await getAllUsers();
    
    // Filter to only drivers and exclude admins
    return allUsers.filter(user => 
      user.accountType === 'driver' && !adminUserIds.includes(user.id)
    );
  } catch (error) {
    console.error('Error getting drivers:', error);
    return [];
  }
};

// Approve a passenger's discount request
export const approveDiscount = async (userId: string): Promise<void> => {
  try {
    console.log('[approveDiscount] Starting approval process for user:', userId);

    // Update passenger discount verification status
    const { data: updateData, error: updateError } = await supabase
      .from('passengers')
      .update({
        discount_verification_status: 'approved',
        discount_verified_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select();

    if (updateError) {
      console.error('[approveDiscount] Update error:', updateError);
      throw updateError;
    }

    console.log('[approveDiscount] Successfully approved discount:', updateData);
  } catch (error) {
    console.error('[approveDiscount] Error approving discount:', error);
    throw error;
  }
};

// Reject a passenger's discount request
export const rejectDiscount = async (userId: string, reason?: string): Promise<void> => {
  try {
    console.log('[rejectDiscount] Starting rejection process for user:', userId);

    // Update passenger discount verification status
    const { data: updateData, error: updateError } = await supabase
      .from('passengers')
      .update({
        discount_verification_status: 'rejected',
        discount_rejection_reason: reason || 'ID verification failed',
        discount_verified_at: null,
      })
      .eq('user_id', userId)
      .select();

    if (updateError) {
      console.error('[rejectDiscount] Update error:', updateError);
      throw updateError;
    }

    console.log('[rejectDiscount] Successfully rejected discount:', updateData);
  } catch (error) {
    console.error('[rejectDiscount] Error rejecting discount:', error);
    throw error;
  }
};

// Get statistics from database
export const getAdminStatistics = async () => {
  try {
    // Get admin user IDs to exclude from counts
    const { data: adminUsers } = await supabase
      .from('admin_users')
      .select('id');
    
    const adminUserIds = adminUsers?.map(admin => admin.id) || [];

    // Build base queries
    let totalUsersQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    let passengersQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('account_type', 'passenger');
    
    let driversQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('account_type', 'driver');

    // Only add exclusion filter if there are admin users
    if (adminUserIds.length > 0) {
      totalUsersQuery = totalUsersQuery.not('id', 'in', `(${adminUserIds.join(',')})`);
      passengersQuery = passengersQuery.not('id', 'in', `(${adminUserIds.join(',')})`);
      driversQuery = driversQuery.not('id', 'in', `(${adminUserIds.join(',')})`);
    }

    // Execute queries
    const { count: totalUsers, error: usersError } = await totalUsersQuery;
    const { count: totalPassengers, error: passengersError } = await passengersQuery;
    const { count: allDriversCount, error: allDriversError } = await driversQuery;


    // Get verified drivers count
    const { count: verifiedDrivers, error: verifiedError } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'verified');

    // Get pending drivers count
    const { count: pendingDrivers, error: pendingError } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'pending');

    // Get rejected drivers count
    const { count: rejectedDrivers, error: rejectedError } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'rejected');

    if (usersError || passengersError || verifiedError || pendingError || rejectedError) {
      console.error('Error getting statistics:', { 
        usersError, 
        passengersError, 
        verifiedError, 
        pendingError, 
        rejectedError 
      });
    }

    console.log('[getAdminStatistics] Raw counts from database:');
    console.log('  - Total Users:', totalUsers);
    console.log('  - Total Passengers:', totalPassengers);
    console.log('  - All Drivers Count:', allDriversCount);
    console.log('  - Verified Drivers:', verifiedDrivers);
    console.log('  - Pending Drivers:', pendingDrivers);
    console.log('  - Rejected Drivers:', rejectedDrivers);

    const stats = {
      totalUsers: totalUsers || 0,
      totalPassengers: totalPassengers || 0,
      totalDrivers: verifiedDrivers || 0, // Only count verified/approved drivers
      verifiedDrivers: verifiedDrivers || 0,
      pendingDrivers: pendingDrivers || 0,
      rejectedDrivers: rejectedDrivers || 0,
    };

    console.log('[getAdminStatistics] Returning statistics:', stats);
    return stats;
  } catch (error) {
    console.error('Error getting statistics:', error);
    return {
      totalUsers: 0,
      totalPassengers: 0,
      totalDrivers: 0,
      verifiedDrivers: 0,
      pendingDrivers: 0,
      rejectedDrivers: 0,
    };
  }
};

