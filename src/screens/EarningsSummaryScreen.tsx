import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, BottomNavigation } from '../components';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { getTripsByUserId } from '../utils/tripStorage';

interface EarningsSummaryScreenProps {
  navigation?: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface EarningsData {
  total: number;
  today: number;
  weekly: number;
  monthly: number;
  completedTrips: number;
  todayTrips: number;
  weeklyTrips: number;
  monthlyTrips: number;
}

export const EarningsSummaryScreen: React.FC<EarningsSummaryScreenProps> = ({
  navigation,
  activeTab,
  onTabChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [earnings, setEarnings] = useState<EarningsData>({
    total: 0,
    today: 0,
    weekly: 0,
    monthly: 0,
    completedTrips: 0,
    todayTrips: 0,
    weeklyTrips: 0,
    monthlyTrips: 0,
  });
  const [commissionRate] = useState<number>(0); // 0% commission for now, can be configured
  const [deductions] = useState<number>(0); // No deductions for now

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    try {
      setLoading(true);
      const currentUserEmail = await AsyncStorage.getItem('current_user_email');
      if (currentUserEmail) {
        const trips = await getTripsByUserId(currentUserEmail, 'driver');
        const completedTrips = trips.filter((trip: any) => trip.status === 'completed');
        
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        monthAgo.setHours(0, 0, 0, 0);

        let totalEarnings = 0;
        let todayEarnings = 0;
        let weeklyEarnings = 0;
        let monthlyEarnings = 0;
        let todayTripCount = 0;
        let weeklyTripCount = 0;
        let monthlyTripCount = 0;

        completedTrips.forEach((trip: any) => {
          const fare = trip.fare || 0;
          const tripDate = new Date(trip.completedAt || trip.createdAt);
          const tripDateOnly = new Date(tripDate);
          tripDateOnly.setHours(0, 0, 0, 0);

          totalEarnings += fare;

          if (tripDateOnly >= today) {
            todayEarnings += fare;
            todayTripCount++;
          }
          if (tripDate >= weekAgo) {
            weeklyEarnings += fare;
            weeklyTripCount++;
          }
          if (tripDate >= monthAgo) {
            monthlyEarnings += fare;
            monthlyTripCount++;
          }
        });

        setEarnings({
          total: totalEarnings,
          today: todayEarnings,
          weekly: weeklyEarnings,
          monthly: monthlyEarnings,
          completedTrips: completedTrips.length,
          todayTrips: todayTripCount,
          weeklyTrips: weeklyTripCount,
          monthlyTrips: monthlyTripCount,
        });
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedEarnings = () => {
    switch (selectedPeriod) {
      case 'today':
        return earnings.today;
      case 'week':
        return earnings.weekly;
      case 'month':
        return earnings.monthly;
      default:
        return earnings.total;
    }
  };

  const getSelectedTripCount = () => {
    switch (selectedPeriod) {
      case 'today':
        return earnings.todayTrips;
      case 'week':
        return earnings.weeklyTrips;
      case 'month':
        return earnings.monthlyTrips;
      default:
        return earnings.completedTrips;
    }
  };

  const tabs = [
    { name: 'home', label: 'Home', icon: 'home-outline' as const, activeIcon: 'home' as const },
    { name: 'trips', label: 'Trips', icon: 'time-outline' as const, activeIcon: 'time' as const },
    { name: 'profile', label: 'Profile', icon: 'person-outline' as const, activeIcon: 'person' as const },
  ];

  const netEarnings = getSelectedEarnings() - (commissionRate * getSelectedEarnings()) / 100 - deductions;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Earnings Summary</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadEarnings}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading earnings...</Text>
          </View>
        ) : (
          <>
            {/* Period Filter */}
            <View style={styles.periodFilter}>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'today' && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod('today')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'today' && styles.periodButtonTextActive]}>
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod('week')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>
                  Week
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod('month')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>
                  Month
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, selectedPeriod === 'all' && styles.periodButtonActive]}
                onPress={() => setSelectedPeriod('all')}
              >
                <Text style={[styles.periodButtonText, selectedPeriod === 'all' && styles.periodButtonTextActive]}>
                  All Time
                </Text>
              </TouchableOpacity>
            </View>

            {/* Total Earnings Card */}
            <Card style={styles.totalEarningsCard}>
              <View style={styles.totalEarningsContent}>
                <View style={styles.totalEarningsIcon}>
                  <Ionicons name="cash" size={32} color={colors.white} />
                </View>
                <View style={styles.totalEarningsInfo}>
                  <Text style={styles.totalEarningsLabel}>
                    {selectedPeriod === 'today' ? "Today's Earnings" :
                     selectedPeriod === 'week' ? "This Week's Earnings" :
                     selectedPeriod === 'month' ? "This Month's Earnings" :
                     "Total Earnings"}
                  </Text>
                  <Text style={styles.totalEarningsAmount}>
                    ₱{getSelectedEarnings().toFixed(2)}
                  </Text>
                  <Text style={styles.totalEarningsSubtext}>
                    {getSelectedTripCount()} completed trip{getSelectedTripCount() !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Breakdown Cards */}
            <View style={styles.breakdownSection}>
              <Text style={styles.sectionTitle}>Breakdown</Text>
              
              <Card style={styles.breakdownCard}>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <Ionicons name="car-outline" size={20} color={colors.primary} />
                    <Text style={styles.breakdownLabel}>Gross Earnings</Text>
                  </View>
                  <Text style={styles.breakdownValue}>
                    ₱{getSelectedEarnings().toFixed(2)}
                  </Text>
                </View>
              </Card>

              {commissionRate > 0 && (
                <Card style={styles.breakdownCard}>
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <Ionicons name="percentage-outline" size={20} color={colors.warning} />
                      <Text style={styles.breakdownLabel}>Commission ({commissionRate}%)</Text>
                    </View>
                    <Text style={[styles.breakdownValue, styles.breakdownDeduction]}>
                      -₱{((commissionRate * getSelectedEarnings()) / 100).toFixed(2)}
                    </Text>
                  </View>
                </Card>
              )}

              {deductions > 0 && (
                <Card style={styles.breakdownCard}>
                  <View style={styles.breakdownRow}>
                    <View style={styles.breakdownLeft}>
                      <Ionicons name="remove-circle-outline" size={20} color={colors.error} />
                      <Text style={styles.breakdownLabel}>Deductions</Text>
                    </View>
                    <Text style={[styles.breakdownValue, styles.breakdownDeduction]}>
                      -₱{deductions.toFixed(2)}
                    </Text>
                  </View>
                </Card>
              )}

              <Card style={[styles.breakdownCard, styles.netEarningsCard]}>
                <View style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <Ionicons name="wallet-outline" size={20} color={colors.success} />
                    <Text style={[styles.breakdownLabel, styles.netEarningsLabel]}>Net Earnings</Text>
                  </View>
                  <Text style={[styles.breakdownValue, styles.netEarningsValue]}>
                    ₱{netEarnings.toFixed(2)}
                  </Text>
                </View>
              </Card>
            </View>

            {/* Period Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Period Summary</Text>
              
              <View style={styles.summaryGrid}>
                <Card style={styles.summaryCard}>
                  <Ionicons name="today-outline" size={24} color={colors.primary} />
                  <Text style={styles.summaryAmount}>₱{earnings.today.toFixed(2)}</Text>
                  <Text style={styles.summaryLabel}>Today</Text>
                  <Text style={styles.summaryCount}>{earnings.todayTrips} trips</Text>
                </Card>

                <Card style={styles.summaryCard}>
                  <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                  <Text style={styles.summaryAmount}>₱{earnings.weekly.toFixed(2)}</Text>
                  <Text style={styles.summaryLabel}>This Week</Text>
                  <Text style={styles.summaryCount}>{earnings.weeklyTrips} trips</Text>
                </Card>

                <Card style={styles.summaryCard}>
                  <Ionicons name="calendar-number-outline" size={24} color={colors.primary} />
                  <Text style={styles.summaryAmount}>₱{earnings.monthly.toFixed(2)}</Text>
                  <Text style={styles.summaryLabel}>This Month</Text>
                  <Text style={styles.summaryCount}>{earnings.monthlyTrips} trips</Text>
                </Card>

                <Card style={styles.summaryCard}>
                  <Ionicons name="stats-chart-outline" size={24} color={colors.primary} />
                  <Text style={styles.summaryAmount}>₱{earnings.total.toFixed(2)}</Text>
                  <Text style={styles.summaryLabel}>All Time</Text>
                  <Text style={styles.summaryCount}>{earnings.completedTrips} trips</Text>
                </Card>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={onTabChange}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    fontWeight: '800',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.gray,
  },
  periodFilter: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  periodButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    ...typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray,
  },
  periodButtonTextActive: {
    color: colors.white,
  },
  totalEarningsCard: {
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
    ...shadows.medium,
  },
  totalEarningsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  totalEarningsIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalEarningsInfo: {
    flex: 1,
  },
  totalEarningsLabel: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
    fontSize: 14,
  },
  totalEarningsAmount: {
    ...typography.h1,
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    marginBottom: spacing.xs,
  },
  totalEarningsSubtext: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.8,
    fontSize: 13,
  },
  breakdownSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  breakdownCard: {
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  breakdownLabel: {
    ...typography.body,
    fontSize: 15,
    color: colors.darkText,
  },
  breakdownValue: {
    ...typography.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  breakdownDeduction: {
    color: colors.error,
  },
  netEarningsCard: {
    backgroundColor: '#E8F5E9',
    marginTop: spacing.sm,
    ...shadows.medium,
  },
  netEarningsLabel: {
    fontWeight: '700',
    color: colors.success,
  },
  netEarningsValue: {
    color: colors.success,
    fontSize: 20,
  },
  summarySection: {
    marginBottom: spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    ...shadows.small,
  },
  summaryAmount: {
    ...typography.h3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.xs,
  },
  summaryCount: {
    ...typography.caption,
    fontSize: 11,
    color: colors.gray,
  },
});
