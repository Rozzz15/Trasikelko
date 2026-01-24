import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  BackHandler,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import {
  getPendingDrivers,
  approveDriver,
  rejectDriver,
  getAllPassengers,
  getAllDrivers,
  getAdminStatistics,
  approveDiscount,
  rejectDiscount,
} from '../utils/adminStorage';
import { UserAccount as UserAccountAdmin } from '../utils/adminStorage';
import { clearAdminSession, isAdminLoggedIn } from '../utils/adminAuth';
import { supabase } from '../config/supabase';

interface AdminDashboardScreenProps {
  navigation: any;
  onLogout: () => void;
}

type TabType = 'overview' | 'drivers' | 'passengers' | 'analytics';

const { width } = Dimensions.get('window');

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  navigation,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [drivers, setDrivers] = useState<UserAccountAdmin[]>([]);
  const [passengers, setPassengers] = useState<UserAccountAdmin[]>([]);
  const [statistics, setStatistics] = useState({
    totalUsers: 0,
    totalPassengers: 0,
    totalDrivers: 0,
    verifiedDrivers: 0,
    pendingDrivers: 0,
    rejectedDrivers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverFilter, setDriverFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [passengerFilter, setPassengerFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageTitle, setImageTitle] = useState<string>('');
  const [previousPendingCount, setPreviousPendingCount] = useState<number>(0);
  const [showNotification, setShowNotification] = useState<boolean>(false);

  useEffect(() => {
    checkAdminSession();
    loadData();
    
    // Set up periodic check for new pending drivers (every 5 seconds for real-time feel)
    const interval = setInterval(() => {
      loadData(true); // Silent refresh - don't show loading spinner
    }, 5000); // Reduced from 30s to 5s for better real-time sync
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Android back button - prevent going back to login
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Show logout confirmation instead of going back
      handleLogout();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  const checkAdminSession = async () => {
    const isLoggedIn = await isAdminLoggedIn();
    if (!isLoggedIn) {
      Alert.alert('Session Expired', 'Please login again to access the admin dashboard.');
      onLogout();
    }
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      console.log('[AdminDashboard] Loading data from database...');
      
      const [allDrivers, allPassengers, stats] = await Promise.all([
        getAllDrivers(),
        getAllPassengers(),
        getAdminStatistics(),
      ]);
      
      console.log('[AdminDashboard] Real-time sync - Loaded drivers:', allDrivers.length);
      console.log('[AdminDashboard] Real-time sync - Loaded passengers:', allPassengers.length);
      
      // Only log detailed info if not silent refresh
      if (!silent) {
        console.log('[AdminDashboard] All drivers data:', JSON.stringify(allDrivers, null, 2));
        
        // Log each driver's status and profile photo
        allDrivers.forEach(driver => {
          console.log(`[AdminDashboard] Driver ${driver.email}:`);
          console.log(`  - status: ${driver.verificationStatus}`);
          console.log(`  - profilePhoto: ${driver.profilePhoto}`);
          console.log(`  - licenseFrontPhoto: ${driver.licenseFrontPhoto}`);
        });
      }
      
      // Check for new pending drivers
      if (previousPendingCount > 0 && stats.pendingDrivers > previousPendingCount) {
        const newPendingCount = stats.pendingDrivers - previousPendingCount;
        setShowNotification(true);
        Alert.alert(
          'New Driver Applications',
          `${newPendingCount} new driver application${newPendingCount > 1 ? 's' : ''} ${newPendingCount > 1 ? 'are' : 'is'} pending review.`,
          [
            {
              text: 'View Now',
              onPress: () => {
                setActiveTab('drivers');
                setDriverFilter('pending');
                setShowNotification(false);
              },
            },
            {
              text: 'Later',
              style: 'cancel',
              onPress: () => setShowNotification(false),
            },
          ]
        );
      } else if (previousPendingCount === 0 && stats.pendingDrivers > 0) {
        // First load with pending drivers
        setPreviousPendingCount(stats.pendingDrivers);
      } else {
        setPreviousPendingCount(stats.pendingDrivers);
      }
      
      setDrivers(allDrivers);
      setPassengers(allPassengers);
      setStatistics(stats);
      
      if (!silent) {
        console.log('[AdminDashboard] Statistics:', stats);
      }
    } catch (error) {
      console.error('[AdminDashboard] Error loading data:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to logout from the admin dashboard? You will need to login again to access the dashboard.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => {
            // Do nothing - stay on dashboard
          }
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[AdminDashboard] Logging out...');
              
              // Clear admin session from AsyncStorage
              await clearAdminSession();
              console.log('[AdminDashboard] Admin session cleared');
              
              // Sign out from Supabase Auth
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('[AdminDashboard] Error signing out from Supabase:', error);
                Alert.alert('Error', 'Failed to logout from Supabase. Please try again.');
                return;
              }
              console.log('[AdminDashboard] Signed out from Supabase successfully');
              
              // Call onLogout to properly handle logout and navigation
              onLogout();
            } catch (error) {
              console.error('[AdminDashboard] Error during logout:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleApprove = async (email: string, driverName: string) => {
    Alert.alert(
      'Approve Driver',
      `Are you sure you want to approve ${driverName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveDriver(email);
              Alert.alert('Success', 'Driver has been approved successfully');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to approve driver');
            }
          },
        },
      ]
    );
  };

  const handleReject = async (email: string, driverName: string) => {
    Alert.alert(
      'Reject Driver',
      `Are you sure you want to reject ${driverName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectDriver(email, 'Rejected by admin');
              Alert.alert('Success', 'Driver has been rejected');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to reject driver');
            }
          },
        },
      ]
    );
  };

  const handleApproveDiscount = async (userId: string, passengerName: string, discountType: string) => {
    Alert.alert(
      'Approve Discount',
      `Approve ${discountType === 'senior' ? 'Senior Citizen' : 'PWD'} discount for ${passengerName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveDiscount(userId);
              Alert.alert('Success', 'Discount has been approved successfully');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to approve discount');
            }
          },
        },
      ]
    );
  };

  const handleRejectDiscount = async (userId: string, passengerName: string, discountType: string) => {
    // Use Alert.alert with predefined rejection reasons (works on all platforms)
    Alert.alert(
      'Reject Discount',
      `Select reason for rejecting ${passengerName}'s ${discountType === 'senior' ? 'Senior Citizen' : 'PWD'} discount:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'ID Photo Unclear',
          onPress: async () => {
            try {
              await rejectDiscount(userId, 'ID photo is unclear or unreadable');
              Alert.alert('Success', 'Discount has been rejected');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to reject discount');
            }
          },
        },
        {
          text: 'Invalid ID',
          onPress: async () => {
            try {
              await rejectDiscount(userId, 'ID appears to be invalid or expired');
              Alert.alert('Success', 'Discount has been rejected');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to reject discount');
            }
          },
        },
        {
          text: 'Wrong ID Type',
          onPress: async () => {
            try {
              await rejectDiscount(userId, 'Uploaded ID does not match the discount type');
              Alert.alert('Success', 'Discount has been rejected');
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to reject discount');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const filteredDrivers = drivers.filter((driver) => {
    if (driverFilter === 'all') return true;
    // Handle undefined/null verificationStatus - treat as 'pending'
    const status = driver.verificationStatus || 'pending';
    
    console.log(`[AdminDashboard] Filtering driver ${driver.email}: status="${status}", filter="${driverFilter}", match=${status === driverFilter}`);
    
    return status === driverFilter;
  });

  const filteredPassengers = passengers.filter((passenger) => {
    if (passengerFilter === 'all') return true;
    const status = passenger.discountVerificationStatus || 'none';
    
    if (passengerFilter === 'pending') {
      return status === 'pending';
    } else if (passengerFilter === 'approved') {
      return status === 'approved';
    } else if (passengerFilter === 'rejected') {
      return status === 'rejected';
    }
    
    return true;
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'verified':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return colors.gray;
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'rejected':
        return 'Rejected';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const renderOverview = () => (
    <ScrollView 
      style={styles.tabContent} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeTitle}>Welcome Back</Text>
          <Text style={styles.welcomeSubtitle}>Admin Dashboard</Text>
        </View>
        <View style={styles.welcomeIcon}>
          <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
        </View>
      </View>

      {/* Statistics Cards - Modern Grid */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{statistics.totalUsers}</Text>
            </View>
            <Text style={styles.statLabel}>Total Users</Text>
            <View style={styles.statTrend}>
              <Ionicons name="trending-up" size={14} color={colors.success} />
              <Text style={styles.statTrendText}>Active</Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.statCardSuccess]}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="person" size={24} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{statistics.totalPassengers}</Text>
            </View>
            <Text style={styles.statLabel}>Passengers</Text>
            <View style={styles.statTrend}>
              <Ionicons name="people-outline" size={14} color={colors.success} />
              <Text style={styles.statTrendText}>Registered</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardWarning]}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="car" size={24} color={colors.warning} />
              </View>
              <Text style={styles.statValue}>{statistics.totalDrivers}</Text>
            </View>
            <Text style={styles.statLabel}>Approved Drivers</Text>
            <View style={styles.statTrend}>
              <Ionicons name="car-outline" size={14} color={colors.warning} />
              <Text style={styles.statTrendText}>Verified</Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.statCardInfo]}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              </View>
              <Text style={styles.statValue}>{statistics.verifiedDrivers}</Text>
            </View>
            <Text style={styles.statLabel}>Verified</Text>
            <View style={styles.statTrend}>
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <Text style={styles.statTrendText}>Approved</Text>
            </View>
          </View>
        </View>

        {/* Pending & Rejected in one row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardPending]}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="time" size={24} color={colors.warning} />
              </View>
              <Text style={styles.statValue}>{statistics.pendingDrivers}</Text>
            </View>
            <Text style={styles.statLabel}>Pending Review</Text>
            <TouchableOpacity 
              style={styles.statAction}
              onPress={() => {
                setActiveTab('drivers');
                setDriverFilter('pending');
              }}
            >
              <Text style={styles.statActionText}>
                {statistics.pendingDrivers > 0 ? 'Review Now →' : 'No Pending'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.statCard, styles.statCardError]}>
            <View style={styles.statCardHeader}>
              <View style={[styles.statIconWrapper, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </View>
              <Text style={styles.statValue}>{statistics.rejectedDrivers}</Text>
            </View>
            <Text style={styles.statLabel}>Rejected</Text>
            <View style={styles.statTrend}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={styles.statTrendText}>Declined</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions - Modern Cards */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => {
              setActiveTab('drivers');
              setDriverFilter('pending');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="document-text" size={28} color={colors.warning} />
            </View>
            <Text style={styles.quickActionTitle}>Review</Text>
            <Text style={styles.quickActionSubtitle}>Applications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => setActiveTab('drivers')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="car" size={28} color={colors.primary} />
            </View>
            <Text style={styles.quickActionTitle}>Manage</Text>
            <Text style={styles.quickActionSubtitle}>Drivers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => setActiveTab('passengers')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="people" size={28} color={colors.success} />
            </View>
            <Text style={styles.quickActionTitle}>View</Text>
            <Text style={styles.quickActionSubtitle}>Passengers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionCard}
            onPress={() => setActiveTab('analytics')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#9B59B6' + '15' }]}>
              <Ionicons name="stats-chart" size={28} color="#9B59B6" />
            </View>
            <Text style={styles.quickActionTitle}>Analytics</Text>
            <Text style={styles.quickActionSubtitle}>Reports</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pending Applications Alert - Priority Section */}
      {statistics.pendingDrivers > 0 && (
        <View style={styles.pendingAlertSection}>
          <View style={styles.pendingAlertHeader}>
            <Ionicons name="alert-circle" size={20} color={colors.warning} />
            <Text style={styles.pendingAlertTitle}>
              {statistics.pendingDrivers} Driver{statistics.pendingDrivers > 1 ? 's' : ''} Awaiting Review
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.pendingAlertButton}
            onPress={() => {
              setActiveTab('drivers');
              setDriverFilter('pending');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.pendingAlertButtonText}>Review Applications →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Pending Applications */}
      <View style={styles.recentSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Applications</Text>
          <TouchableOpacity onPress={() => {
            setActiveTab('drivers');
            setDriverFilter('pending');
          }}>
            <Text style={styles.seeAllText}>See All →</Text>
          </TouchableOpacity>
        </View>
        {drivers.filter(d => d.verificationStatus === 'pending').length > 0 ? (
          drivers.filter(d => d.verificationStatus === 'pending').slice(0, 3).map((driver) => {
            console.log(`[AdminDashboard OVERVIEW] Rendering recent card for: ${driver.email}`);
            console.log(`[AdminDashboard OVERVIEW] - profilePhoto: "${driver.profilePhoto}"`);
            
            return (
            <TouchableOpacity
              key={driver.email}
              style={styles.recentCard}
              activeOpacity={0.7}
              onPress={() => {
                setActiveTab('drivers');
                setDriverFilter('pending');
              }}
            >
              <View style={styles.recentCardContent}>
                <View style={styles.recentCardLeft}>
                  {driver.profilePhoto ? (
                    <Image 
                      source={{ uri: driver.profilePhoto }} 
                      style={styles.recentAvatar}
                      onError={(e) => console.log(`[Overview] Failed to load profile photo for ${driver.email}:`, e.nativeEvent.error)}
                      onLoad={() => console.log(`[Overview] Profile photo loaded for ${driver.email}`)}
                    />
                  ) : (
                    <View style={styles.recentAvatarPlaceholder}>
                      <Ionicons name="person" size={20} color={colors.white} />
                    </View>
                  )}
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentName} numberOfLines={1}>{driver.fullName}</Text>
                    <Text style={styles.recentEmail} numberOfLines={1}>{driver.email}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.recentBadge,
                    { backgroundColor: colors.warning + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.recentBadgeText,
                      { color: colors.warning },
                    ]}
                  >
                    Pending
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
            <Text style={styles.emptyStateText}>No pending applications</Text>
            <Text style={styles.emptyStateSubtext}>All driver applications have been reviewed</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderDrivers = () => (
    <View style={styles.tabContent}>
      {/* Filter Tabs - Modern Design */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {(['all', 'pending', 'verified', 'rejected'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterChip,
              driverFilter === filterOption && styles.filterChipActive,
            ]}
            onPress={() => setDriverFilter(filterOption)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                driverFilter === filterOption && styles.filterChipTextActive,
              ]}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
            {driverFilter === filterOption && (
              <View style={styles.filterChipBadge}>
                <Text style={styles.filterChipBadgeText}>
                  {filterOption === 'all' 
                    ? drivers.length 
                    : drivers.filter(d => {
                        const status = d.verificationStatus || 'pending';
                        return status === filterOption;
                      }).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading drivers...</Text>
          </View>
        ) : filteredDrivers.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="document-text-outline" size={64} color={colors.gray} />
            </View>
            <Text style={styles.emptyText}>No drivers found</Text>
            <Text style={styles.emptySubtext}>
              {driverFilter === 'pending'
                ? 'No pending driver applications'
                : `No ${driverFilter} drivers`}
            </Text>
          </View>
        ) : (
          filteredDrivers.map((driver) => {
            console.log(`[AdminDashboard RENDER] Rendering driver card for: ${driver.email}`);
            console.log(`[AdminDashboard RENDER] - profilePhoto value: "${driver.profilePhoto}"`);
            console.log(`[AdminDashboard RENDER] - Will show image: ${!!driver.profilePhoto}`);
            
            return (
            <View key={driver.email} style={styles.modernCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  {driver.profilePhoto ? (
                    <Image 
                      source={{ uri: driver.profilePhoto }} 
                      style={styles.modernAvatar}
                      onError={(e) => {
                        console.log(`[AdminDashboard] Failed to load profile photo for ${driver.email}:`, e.nativeEvent.error);
                        console.log(`[AdminDashboard] Image URI was: ${driver.profilePhoto}`);
                      }}
                      onLoad={() => console.log(`[AdminDashboard] Profile photo loaded successfully for ${driver.email}`)}
                    />
                  ) : (
                    <View style={styles.modernAvatarPlaceholder}>
                      <Ionicons name="person" size={24} color={colors.white} />
                    </View>
                  )}
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.modernName}>{driver.fullName}</Text>
                    <Text style={styles.modernEmail}>{driver.email}</Text>
                    <Text style={styles.modernPhone}>{driver.phoneNumber}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.modernBadge,
                    { backgroundColor: getStatusColor(driver.verificationStatus) + '15' },
                  ]}
                >
                  <View
                    style={[
                      styles.modernBadgeDot,
                      { backgroundColor: getStatusColor(driver.verificationStatus) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.modernBadgeText,
                      { color: getStatusColor(driver.verificationStatus) },
                    ]}
                  >
                    {getStatusText(driver.verificationStatus)}
                  </Text>
                </View>
              </View>

              <View style={styles.modernDetails}>
                <View style={styles.modernDetailItem}>
                  <Ionicons name="location" size={18} color={colors.primary} />
                  <Text style={styles.modernDetailText}>{driver.address || 'No address'}</Text>
                </View>
                <View style={styles.modernDetailItem}>
                  <Ionicons name="id-card" size={18} color={colors.primary} />
                  <Text style={styles.modernDetailText}>
                    License: {driver.driversLicenseNumber || 'N/A'}
                  </Text>
                </View>
                {driver.licenseExpiryDate && (
                  <View style={styles.modernDetailItem}>
                    <Ionicons name="calendar" size={18} color={colors.primary} />
                    <Text style={styles.modernDetailText}>
                      Expires: {new Date(driver.licenseExpiryDate).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                <View style={styles.modernDetailItem}>
                  <Ionicons name="car" size={18} color={colors.primary} />
                  <Text style={styles.modernDetailText}>Plate: {driver.plateNumber || 'N/A'}</Text>
                </View>
                {driver.vehicleModel && (
                  <View style={styles.modernDetailItem}>
                    <Ionicons name="construct" size={18} color={colors.primary} />
                    <Text style={styles.modernDetailText}>
                      Vehicle: {driver.vehicleModel}{driver.vehicleColor ? ` (${driver.vehicleColor})` : null}
                    </Text>
                  </View>
                )}
                {driver.franchiseNumber && (
                  <View style={styles.modernDetailItem}>
                    <Ionicons name="document-text" size={18} color={colors.primary} />
                    <Text style={styles.modernDetailText}>
                      Franchise: {driver.franchiseNumber}
                    </Text>
                  </View>
                )}
                {driver.submittedAt && (
                  <View style={styles.modernDetailItem}>
                    <Ionicons name="time" size={18} color={colors.gray} />
                    <Text style={[styles.modernDetailText, { color: colors.gray, fontSize: 12 }]}>
                      Submitted: {new Date(driver.submittedAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
                {driver.verifiedAt && (
                  <View style={styles.modernDetailItem}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <Text style={[styles.modernDetailText, { color: colors.success, fontSize: 12 }]}>
                      Verified: {new Date(driver.verifiedAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Profile Photo */}
              {driver.profilePhoto && (
                <View style={styles.modernPhotosSection}>
                  <Text style={styles.modernPhotosTitle}>Profile Photo</Text>
                  <TouchableOpacity 
                    style={styles.modernPhotoContainer}
                    activeOpacity={0.9}
                    onPress={() => {
                      setSelectedImage(driver.profilePhoto || null);
                      setImageTitle('Profile Photo');
                    }}
                  >
                    <Image
                      source={{ uri: driver.profilePhoto }}
                      style={styles.modernPhoto}
                      resizeMode="cover"
                      onError={(e) => console.log('Failed to load profile photo:', e.nativeEvent.error)}
                      onLoad={() => console.log('Profile photo loaded successfully')}
                    />
                    <Text style={styles.modernPhotoLabel}>Profile Photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* License Photos */}
              {(driver.licenseFrontPhoto || driver.licenseBackPhoto) && (
                <View style={styles.modernPhotosSection}>
                  <Text style={styles.modernPhotosTitle}>Driver's License</Text>
                  <View style={styles.modernPhotosRow}>
                    {driver.licenseFrontPhoto && (
                      <TouchableOpacity 
                        style={styles.modernPhotoContainer}
                        activeOpacity={0.9}
                        onPress={() => {
                          setSelectedImage(driver.licenseFrontPhoto || null);
                          setImageTitle('License Front');
                        }}
                      >
                        <Image
                          source={{ uri: driver.licenseFrontPhoto }}
                          style={styles.modernPhoto}
                          resizeMode="cover"
                          onError={(e) => console.log('Failed to load license front:', e.nativeEvent.error)}
                          onLoad={() => console.log('License front loaded successfully')}
                        />
                        <Text style={styles.modernPhotoLabel}>Front</Text>
                      </TouchableOpacity>
                    )}
                    {driver.licenseBackPhoto && (
                      <TouchableOpacity 
                        style={styles.modernPhotoContainer}
                        activeOpacity={0.9}
                        onPress={() => {
                          setSelectedImage(driver.licenseBackPhoto || null);
                          setImageTitle('License Back');
                        }}
                      >
                        <Image
                          source={{ uri: driver.licenseBackPhoto }}
                          style={styles.modernPhoto}
                          resizeMode="cover"
                          onError={(e) => console.log('Failed to load license back:', e.nativeEvent.error)}
                          onLoad={() => console.log('License back loaded successfully')}
                        />
                        <Text style={styles.modernPhotoLabel}>Back</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* ORCR Photo */}
              {driver.orcrPhoto && (
                <View style={styles.modernPhotosSection}>
                  <Text style={styles.modernPhotosTitle}>OR/CR Document</Text>
                  <TouchableOpacity 
                    style={styles.modernPhotoContainer}
                    activeOpacity={0.9}
                    onPress={() => {
                      setSelectedImage(driver.orcrPhoto || null);
                      setImageTitle('OR/CR Document');
                    }}
                  >
                    <Image
                      source={{ uri: driver.orcrPhoto }}
                      style={styles.modernPhoto}
                      resizeMode="cover"
                      onError={(e) => console.log('Failed to load ORCR:', e.nativeEvent.error)}
                      onLoad={() => console.log('ORCR loaded successfully')}
                    />
                    <Text style={styles.modernPhotoLabel}>OR/CR Photo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {((driver.verificationStatus === 'pending') || !driver.verificationStatus) && (
                <View style={styles.modernActions}>
                  <TouchableOpacity
                    style={[styles.modernActionButton, styles.rejectActionButton]}
                    onPress={() => handleReject(driver.email, driver.fullName)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                    <Text style={[styles.modernActionText, { color: colors.error }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modernActionButton, styles.approveActionButton]}
                    onPress={() => handleApprove(driver.email, driver.fullName)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                    <Text style={[styles.modernActionText, { color: colors.white }]}>Approve</Text>
                  </TouchableOpacity>
                </View>
              )}

              {driver.verificationStatus === 'rejected' && driver.rejectionReason && (
                <View style={styles.modernRejectionSection}>
                  <View style={styles.modernRejectionHeader}>
                    <Ionicons name="alert-circle" size={18} color={colors.error} />
                    <Text style={styles.modernRejectionLabel}>Rejection Reason</Text>
                  </View>
                  <Text style={styles.modernRejectionText}>{driver.rejectionReason}</Text>
                </View>
              )}
            </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const renderPassengers = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, passengerFilter === 'all' && styles.filterChipActive]}
            onPress={() => setPassengerFilter('all')}
          >
            <Text style={[styles.filterChipText, passengerFilter === 'all' && styles.filterChipTextActive]}>
              All ({passengers.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, passengerFilter === 'pending' && styles.filterChipActive]}
            onPress={() => setPassengerFilter('pending')}
          >
            <Text style={[styles.filterChipText, passengerFilter === 'pending' && styles.filterChipTextActive]}>
              Pending ({passengers.filter(p => p.discountVerificationStatus === 'pending').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, passengerFilter === 'approved' && styles.filterChipActive]}
            onPress={() => setPassengerFilter('approved')}
          >
            <Text style={[styles.filterChipText, passengerFilter === 'approved' && styles.filterChipTextActive]}>
              Approved ({passengers.filter(p => p.discountVerificationStatus === 'approved').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, passengerFilter === 'rejected' && styles.filterChipActive]}
            onPress={() => setPassengerFilter('rejected')}
          >
            <Text style={[styles.filterChipText, passengerFilter === 'rejected' && styles.filterChipTextActive]}>
              Rejected ({passengers.filter(p => p.discountVerificationStatus === 'rejected').length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading passengers...</Text>
        </View>
      ) : filteredPassengers.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="people-outline" size={64} color={colors.gray} />
          </View>
          <Text style={styles.emptyText}>No passengers found</Text>
        </View>
      ) : (
        filteredPassengers.map((passenger) => (
          <View key={passenger.email} style={styles.modernCard}>
            {/* Passenger Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                {passenger.profilePhoto ? (
                  <Image source={{ uri: passenger.profilePhoto }} style={styles.modernAvatar} />
                ) : (
                  <View style={styles.modernAvatarPlaceholder}>
                    <Ionicons name="person" size={24} color={colors.white} />
                  </View>
                )}
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.modernName}>{passenger.fullName}</Text>
                  <Text style={styles.modernEmail}>{passenger.email}</Text>
                  <Text style={styles.modernPhone}>{passenger.phoneNumber}</Text>
                </View>
              </View>
              <View style={[styles.modernBadge, { backgroundColor: colors.success + '15' }]}>
                <View style={[styles.modernBadgeDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.modernBadgeText, { color: colors.success }]}>Active</Text>
              </View>
            </View>

            {/* Discount Verification Section */}
            {passenger.discountVerificationStatus && passenger.discountVerificationStatus !== 'none' && (
              <View style={styles.discountSection}>
                <View style={styles.discountHeader}>
                  <View style={styles.discountHeaderLeft}>
                    <Ionicons 
                      name={passenger.discountType === 'senior' ? 'person' : 'heart'} 
                      size={20} 
                      color={colors.primary} 
                    />
                    <Text style={styles.discountTitle}>
                      {passenger.discountType === 'senior' ? 'Senior Citizen' : 'PWD'} Discount
                    </Text>
                  </View>
                  <View style={[
                    styles.discountStatusBadge,
                    {
                      backgroundColor: 
                        passenger.discountVerificationStatus === 'approved' ? colors.success + '15' :
                        passenger.discountVerificationStatus === 'rejected' ? colors.error + '15' :
                        colors.warning + '15'
                    }
                  ]}>
                    <Text style={[
                      styles.discountStatusText,
                      {
                        color: 
                          passenger.discountVerificationStatus === 'approved' ? colors.success :
                          passenger.discountVerificationStatus === 'rejected' ? colors.error :
                          colors.warning
                      }
                    ]}>
                      {passenger.discountVerificationStatus === 'approved' ? 'Approved' :
                       passenger.discountVerificationStatus === 'rejected' ? 'Rejected' :
                       'Pending Review'}
                    </Text>
                  </View>
                </View>

                {/* ID Photos */}
                {(passenger.seniorIdPhoto || passenger.pwdIdPhoto) && (
                  <View style={styles.idPhotosContainer}>
                    <Text style={styles.idPhotosLabel}>Uploaded ID:</Text>
                    <View style={styles.idPhotosRow}>
                      {passenger.discountType === 'senior' && passenger.seniorIdPhoto && (
                        <>
                          {passenger.seniorIdPhoto.includes('|') ? (
                            <>
                              <TouchableOpacity 
                                style={styles.idPhotoWrapper}
                                onPress={() => {
                                  setSelectedImage(passenger.seniorIdPhoto!.split('|')[0]);
                                  setImageTitle('Senior Citizen ID - Front');
                                }}
                              >
                                <Image 
                                  source={{ uri: passenger.seniorIdPhoto.split('|')[0] }} 
                                  style={styles.idPhoto}
                                />
                                <Text style={styles.idPhotoLabel}>Front</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.idPhotoWrapper}
                                onPress={() => {
                                  setSelectedImage(passenger.seniorIdPhoto!.split('|')[1]);
                                  setImageTitle('Senior Citizen ID - Back');
                                }}
                              >
                                <Image 
                                  source={{ uri: passenger.seniorIdPhoto.split('|')[1] }} 
                                  style={styles.idPhoto}
                                />
                                <Text style={styles.idPhotoLabel}>Back</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity 
                              style={styles.idPhotoWrapper}
                              onPress={() => {
                                setSelectedImage(passenger.seniorIdPhoto!);
                                setImageTitle('Senior Citizen ID');
                              }}
                            >
                              <Image 
                                source={{ uri: passenger.seniorIdPhoto }} 
                                style={styles.idPhoto}
                              />
                              <Text style={styles.idPhotoLabel}>ID Photo</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                      {passenger.discountType === 'pwd' && passenger.pwdIdPhoto && (
                        <>
                          {passenger.pwdIdPhoto.includes('|') ? (
                            <>
                              <TouchableOpacity 
                                style={styles.idPhotoWrapper}
                                onPress={() => {
                                  setSelectedImage(passenger.pwdIdPhoto!.split('|')[0]);
                                  setImageTitle('PWD ID - Front');
                                }}
                              >
                                <Image 
                                  source={{ uri: passenger.pwdIdPhoto.split('|')[0] }} 
                                  style={styles.idPhoto}
                                />
                                <Text style={styles.idPhotoLabel}>Front</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.idPhotoWrapper}
                                onPress={() => {
                                  setSelectedImage(passenger.pwdIdPhoto!.split('|')[1]);
                                  setImageTitle('PWD ID - Back');
                                }}
                              >
                                <Image 
                                  source={{ uri: passenger.pwdIdPhoto.split('|')[1] }} 
                                  style={styles.idPhoto}
                                />
                                <Text style={styles.idPhotoLabel}>Back</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity 
                              style={styles.idPhotoWrapper}
                              onPress={() => {
                                setSelectedImage(passenger.pwdIdPhoto!);
                                setImageTitle('PWD ID');
                              }}
                            >
                              <Image 
                                source={{ uri: passenger.pwdIdPhoto }} 
                                style={styles.idPhoto}
                              />
                              <Text style={styles.idPhotoLabel}>ID Photo</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                )}

                {/* Rejection Reason */}
                {passenger.discountVerificationStatus === 'rejected' && passenger.discountRejectionReason && (
                  <View style={styles.rejectionReasonContainer}>
                    <Text style={styles.rejectionReasonLabel}>Rejection Reason:</Text>
                    <Text style={styles.rejectionReasonText}>{passenger.discountRejectionReason}</Text>
                  </View>
                )}

                {/* Action Buttons for Pending */}
                {passenger.discountVerificationStatus === 'pending' && (
                  <View style={styles.discountActionsContainer}>
                    <TouchableOpacity
                      style={[styles.discountActionButton, styles.approveButton]}
                      onPress={() => handleApproveDiscount(passenger.id, passenger.fullName, passenger.discountType!)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                      <Text style={styles.discountActionButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.discountActionButton, styles.rejectButton]}
                      onPress={() => handleRejectDiscount(passenger.id, passenger.fullName, passenger.discountType!)}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.white} />
                      <Text style={styles.discountActionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderAnalytics = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.modernCard}>
        <Text style={styles.modernCardTitle}>User Distribution</Text>
        <View style={styles.analyticsContainer}>
          <View style={styles.analyticsItem}>
            <View style={styles.analyticsHeader}>
              <Ionicons name="person" size={20} color={colors.success} />
              <Text style={styles.analyticsLabel}>Passengers</Text>
            </View>
            <Text style={styles.analyticsValue}>{statistics.totalPassengers}</Text>
            <View style={styles.analyticsBarContainer}>
              <View 
                style={[
                  styles.analyticsBar, 
                  { 
                    width: `${(statistics.totalPassengers / (statistics.totalUsers || 1)) * 100}%`,
                    backgroundColor: colors.success 
                  }
                ]} 
              />
            </View>
          </View>
          <View style={styles.analyticsItem}>
            <View style={styles.analyticsHeader}>
              <Ionicons name="car" size={20} color={colors.warning} />
              <Text style={styles.analyticsLabel}>Drivers</Text>
            </View>
            <Text style={styles.analyticsValue}>{statistics.totalDrivers}</Text>
            <View style={styles.analyticsBarContainer}>
              <View 
                style={[
                  styles.analyticsBar, 
                  { 
                    width: `${(statistics.totalDrivers / (statistics.totalUsers || 1)) * 100}%`,
                    backgroundColor: colors.warning 
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.modernCard}>
        <Text style={styles.modernCardTitle}>Driver Status</Text>
        <View style={styles.statusBreakdown}>
          <View style={styles.statusBreakdownItem}>
            <View style={[styles.statusBreakdownDot, { backgroundColor: colors.success }]} />
            <Text style={styles.statusBreakdownLabel}>Verified</Text>
            <Text style={styles.statusBreakdownValue}>{statistics.verifiedDrivers}</Text>
          </View>
          <View style={styles.statusBreakdownItem}>
            <View style={[styles.statusBreakdownDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.statusBreakdownLabel}>Pending</Text>
            <Text style={styles.statusBreakdownValue}>{statistics.pendingDrivers}</Text>
          </View>
          <View style={styles.statusBreakdownItem}>
            <View style={[styles.statusBreakdownDot, { backgroundColor: colors.error }]} />
            <Text style={styles.statusBreakdownLabel}>Rejected</Text>
            <Text style={styles.statusBreakdownValue}>{statistics.rejectedDrivers}</Text>
          </View>
        </View>
      </View>

      <View style={styles.modernCard}>
        <Text style={styles.modernCardTitle}>System Status</Text>
        <View style={styles.systemInfo}>
          <View style={styles.systemInfoItem}>
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <Text style={styles.systemInfoText}>Admin Dashboard Active</Text>
          </View>
          <View style={styles.systemInfoItem}>
            <Ionicons name="lock-closed" size={20} color={colors.success} />
            <Text style={styles.systemInfoText}>Secure Access Enabled</Text>
          </View>
          <View style={styles.systemInfoItem}>
            <Ionicons name="time" size={20} color={colors.gray} />
            <Text style={styles.systemInfoText}>
              Last Updated: {new Date().toLocaleString()}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Modern Header */}
      <View style={styles.modernHeader}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.modernHeaderTitle}>Admin Dashboard</Text>
            <Text style={styles.modernHeaderSubtitle}>System Management</Text>
          </View>
          <TouchableOpacity 
            onPress={handleLogout} 
            style={styles.modernLogoutButton}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modern Tab Navigation */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.modernTabsContainer}
        contentContainerStyle={styles.modernTabsContent}
      >
        {[
          { key: 'overview', label: 'Overview', icon: 'grid' },
          { key: 'drivers', label: 'Drivers', icon: 'car', showBadge: statistics.pendingDrivers > 0 },
          { key: 'passengers', label: 'Passengers', icon: 'people' },
          { key: 'analytics', label: 'Analytics', icon: 'stats-chart' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.modernTab,
              activeTab === tab.key && styles.modernTabActive,
            ]}
            onPress={() => setActiveTab(tab.key as TabType)}
            activeOpacity={0.7}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? colors.primary : colors.gray}
              />
              {tab.showBadge && statistics.pendingDrivers > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {statistics.pendingDrivers > 9 ? '9+' : statistics.pendingDrivers}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.modernTabText,
                activeTab === tab.key && styles.modernTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'drivers' && renderDrivers()}
      {activeTab === 'passengers' && renderPassengers()}
      {activeTab === 'analytics' && renderAnalytics()}

      {/* Full Size Image Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageModalContainer}>
          <View style={styles.imageModalHeader}>
            <Text style={styles.imageModalTitle}>{imageTitle}</Text>
            <TouchableOpacity
              onPress={() => setSelectedImage(null)}
              style={styles.imageModalCloseButton}
            >
              <Ionicons name="close" size={28} color={colors.white} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.imageModalContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullSizeImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background, // Match login form background
  },
  modernHeader: {
    backgroundColor: colors.white,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadows.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modernHeaderTitle: {
    ...typography.h1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: 1,
  },
  modernHeaderSubtitle: {
    ...typography.body,
    fontSize: 11,
    color: colors.gray,
  },
  modernLogoutButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error + '10',
  },
  modernTabsContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 44,
  },
  modernTabsContent: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    gap: 2,
  },
  modernTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
    marginRight: spacing.xs,
    backgroundColor: colors.lightGray,
    minHeight: 32,
  },
  modernTabActive: {
    backgroundColor: colors.primary + '15',
  },
  modernTabText: {
    ...typography.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray,
  },
  modernTabTextActive: {
    color: colors.primary,
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
  },
  tabBadgeText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.sm,
    paddingBottom: spacing.lg,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeTitle: {
    ...typography.h1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: 2,
  },
  welcomeSubtitle: {
    ...typography.body,
    fontSize: 12,
    color: colors.gray,
  },
  welcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...shadows.small,
  },
  statCardPrimary: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statCardSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  statCardWarning: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  statCardInfo: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statCardPending: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  statCardError: {
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...typography.h1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.darkText,
  },
  statLabel: {
    ...typography.body,
    fontSize: 11,
    color: colors.gray,
    marginBottom: 2,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statTrendText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
  },
  statAction: {
    marginTop: spacing.xs,
  },
  statActionText: {
    ...typography.body,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  quickActionsSection: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickActionCard: {
    width: (width - spacing.sm * 3) / 2,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    ...shadows.small,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionTitle: {
    ...typography.bodyBold,
    fontSize: 12,
    color: colors.darkText,
    marginBottom: 1,
  },
  quickActionSubtitle: {
    ...typography.caption,
    fontSize: 10,
    color: colors.gray,
  },
  pendingAlertSection: {
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  pendingAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pendingAlertTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.darkText,
    flex: 1,
  },
  pendingAlertButton: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  pendingAlertButtonText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.white,
  },
  recentSection: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  seeAllText: {
    ...typography.body,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  recentCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    ...shadows.small,
  },
  recentCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.sm,
  },
  recentAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.darkText,
    marginBottom: 1,
  },
  recentEmail: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
  },
  recentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  recentBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.gray,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    ...typography.caption,
    color: colors.gray,
    marginTop: spacing.xs,
    fontSize: 12,
    textAlign: 'center',
  },
  filterScroll: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    maxHeight: 44,
  },
  filterContainer: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    gap: 2,
  },
  filterChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.lightGray,
    marginRight: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
  },
  filterChipActive: {
    backgroundColor: colors.primary + '15',
  },
  filterChipText: {
    ...typography.body,
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  filterChipBadge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  filterChipBadgeText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIconContainer: {
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.gray,
    marginTop: spacing.md,
  },
  emptyText: {
    ...typography.h3,
    fontSize: 18,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    color: colors.darkText,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.gray,
    textAlign: 'center',
  },
  modernCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  modernAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.sm,
  },
  modernAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  modernName: {
    ...typography.h3,
    fontSize: 15,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: 2,
  },
  modernEmail: {
    ...typography.body,
    fontSize: 12,
    color: colors.gray,
    marginBottom: 1,
  },
  modernPhone: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
  },
  modernBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  modernBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modernBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  modernDetails: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  modernDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modernDetailText: {
    ...typography.body,
    fontSize: 12,
    color: colors.darkText,
    flex: 1,
  },
  modernPhotosSection: {
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modernPhotosTitle: {
    ...typography.bodyBold,
    fontSize: 13,
    marginBottom: spacing.xs,
    color: colors.darkText,
  },
  modernPhotosRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modernPhotoContainer: {
    flex: 1,
  },
  modernPhoto: {
    width: '100%',
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    marginBottom: spacing.xs,
  },
  modernPhotoLabel: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.gray,
    fontSize: 10,
  },
  modernActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modernActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  rejectActionButton: {
    backgroundColor: colors.error + '10',
    borderWidth: 1,
    borderColor: colors.error,
  },
  approveActionButton: {
    backgroundColor: colors.success,
  },
  modernActionText: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  modernRejectionSection: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.error + '08',
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  modernRejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  modernRejectionLabel: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.error,
  },
  modernRejectionText: {
    ...typography.body,
    fontSize: 13,
    color: colors.darkText,
  },
  modernCardTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  analyticsContainer: {
    gap: spacing.md,
  },
  analyticsItem: {
    padding: spacing.md,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  analyticsLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.darkText,
    fontWeight: '600',
  },
  analyticsValue: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.darkText,
    marginBottom: spacing.sm,
  },
  analyticsBarContainer: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  analyticsBar: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  statusBreakdown: {
    gap: spacing.md,
  },
  statusBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusBreakdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusBreakdownLabel: {
    ...typography.body,
    flex: 1,
    fontSize: 14,
    color: colors.darkText,
  },
  statusBreakdownValue: {
    ...typography.bodyBold,
    fontSize: 18,
    color: colors.darkText,
  },
  systemInfo: {
    gap: spacing.md,
  },
  systemInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  systemInfoText: {
    ...typography.body,
    fontSize: 14,
    color: colors.darkText,
  },
  imageModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingTop: spacing.xl,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  imageModalTitle: {
    ...typography.h3,
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  imageModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    paddingVertical: spacing.xl,
  },
  fullSizeImage: {
    width: width,
    height: width * 1.5,
  },
  // Discount Verification Styles
  discountSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  discountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  discountHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discountTitle: {
    ...typography.h3,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.xs,
    color: colors.darkText,
  },
  discountStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  discountStatusText: {
    ...typography.body,
    fontSize: 12,
    fontWeight: '600',
  },
  idPhotosContainer: {
    marginTop: spacing.sm,
  },
  idPhotosLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  idPhotosRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  idPhotoWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  idPhoto: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.lightGray,
  },
  idPhotoLabel: {
    ...typography.body,
    fontSize: 12,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  rejectionReasonContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  rejectionReasonLabel: {
    ...typography.body,
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  rejectionReasonText: {
    ...typography.body,
    fontSize: 14,
    color: colors.darkText,
  },
  discountActionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  discountActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  discountActionButtonText: {
    ...typography.button,
    color: colors.white,
    fontSize: 14,
  },
});
