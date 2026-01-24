import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { getAllLopezDestinations, FareRoute } from '../utils/lopezFares';

interface BarangaySelectorProps {
  onSelect: (barangayName: string) => void;
  placeholder?: string;
}

export const BarangaySelector: React.FC<BarangaySelectorProps> = ({
  onSelect,
  placeholder = 'Select destination barangay',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState<string | null>(null);

  const allDestinations = getAllLopezDestinations();

  // Filter destinations based on search query
  const filteredDestinations = allDestinations.filter((dest) =>
    dest.destination.toUpperCase().includes(searchQuery.toUpperCase())
  );

  // Group by route for organized display
  const groupedByRoute: Record<string, FareRoute[]> = {};
  filteredDestinations.forEach((dest) => {
    const route = dest.route || 'Other';
    if (!groupedByRoute[route]) {
      groupedByRoute[route] = [];
    }
    groupedByRoute[route].push(dest);
  });

  const handleSelect = (barangayName: string) => {
    setSelectedBarangay(barangayName);
    onSelect(barangayName);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.selectorContent}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={styles.selectorText}>
            {selectedBarangay || placeholder}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.gray} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Destination</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={colors.darkText} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search barangay..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.gray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Barangay List */}
          <FlatList
            data={Object.keys(groupedByRoute)}
            keyExtractor={(route) => route}
            renderItem={({ item: route }) => (
              <View style={styles.routeSection}>
                <Text style={styles.routeHeader}>Route {route}</Text>
                {groupedByRoute[route].map((dest) => (
                  <TouchableOpacity
                    key={dest.destination}
                    style={styles.barangayItem}
                    onPress={() => handleSelect(dest.destination)}
                  >
                    <View style={styles.barangayInfo}>
                      <Text style={styles.barangayName}>{dest.destination}</Text>
                      <View style={styles.fareInfo}>
                        <Text style={styles.regularFare}>₱{dest.regularFare}</Text>
                        <Text style={styles.discountFare}>
                          Senior/PWD: ₱{dest.seniorPwdFare}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.gray} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            contentContainerStyle={styles.listContent}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    ...typography.body,
    marginLeft: spacing.sm,
    color: colors.darkText,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.darkText,
  },
  closeButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    marginLeft: spacing.sm,
    color: colors.darkText,
  },
  listContent: {
    padding: spacing.lg,
  },
  routeSection: {
    marginBottom: spacing.lg,
  },
  routeHeader: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  barangayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  barangayInfo: {
    flex: 1,
  },
  barangayName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.darkText,
    marginBottom: spacing.xs,
  },
  fareInfo: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  regularFare: {
    ...typography.body,
    fontSize: 12,
    color: colors.gray,
  },
  discountFare: {
    ...typography.body,
    fontSize: 12,
    color: colors.success,
  },
});
