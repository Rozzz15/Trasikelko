import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { colors, spacing, borderRadius, typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetProps {
  children: React.ReactNode;
  snapPoints?: string[];
  title?: string;
  onClose?: () => void;
  enablePanDownToClose?: boolean;
}

export interface BottomSheetRef {
  snapToIndex: (index: number) => void;
  close: () => void;
}

export const CustomBottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(({
  children,
  snapPoints = ['50%', '90%'],
  title,
  onClose,
  enablePanDownToClose = true,
}, ref) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  const snapPointsMemo = useMemo(() => {
    return snapPoints.map((point) => {
      if (point.includes('%')) {
        const percentage = parseFloat(point.replace('%', ''));
        return (percentage / 100) * SCREEN_HEIGHT;
      }
      return parseFloat(point);
    });
  }, [snapPoints]);

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.close();
    onClose?.();
  }, [onClose]);

  useImperativeHandle(ref, () => ({
    snapToIndex: (index: number) => {
      bottomSheetRef.current?.snapToIndex(index);
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPointsMemo}
      enablePanDownToClose={enablePanDownToClose}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      onClose={onClose}
    >
      <View style={styles.content}>
        {title && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {onClose && (
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.darkText} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {children}
      </View>
    </BottomSheet>
  );
});

CustomBottomSheet.displayName = 'CustomBottomSheet';

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  handleIndicator: {
    backgroundColor: colors.gray,
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.darkText,
  },
  closeButton: {
    padding: spacing.xs,
  },
});
