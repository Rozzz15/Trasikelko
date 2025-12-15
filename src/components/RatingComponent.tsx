import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface RatingComponentProps {
  onRate: (rating: number, feedback?: string) => void;
  title?: string;
  subtitle?: string;
}

export const RatingComponent: React.FC<RatingComponentProps> = ({
  onRate,
  title = 'Rate your experience',
  subtitle = 'How was your ride?',
}) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleStarPress = (selectedRating: number) => {
    setRating(selectedRating);
  };

  const handleSubmit = () => {
    if (rating > 0) {
      onRate(rating, feedback.trim() || undefined);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleStarPress(star)}
            activeOpacity={0.7}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={40}
              color={star <= rating ? colors.warning : colors.gray}
            />
          </TouchableOpacity>
        ))}
      </View>

      {rating > 0 && (
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackLabel}>Optional Feedback</Text>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Tell us about your experience..."
            placeholderTextColor={colors.gray}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={4}
          />
        </View>
      )}

      {rating > 0 && (
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.submitButtonText}>Submit Rating</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.gray,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  starButton: {
    padding: spacing.xs,
  },
  feedbackContainer: {
    width: '100%',
    marginBottom: spacing.md,
  },
  feedbackLabel: {
    ...typography.bodyBold,
    marginBottom: spacing.sm,
  },
  feedbackInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
  submitButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
  },
  submitButtonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '700',
  },
});


