import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Btn, Card, EmptyCard, SectionTitle } from '../components';
import { StarRow } from '../Stars';
import { timeLabel } from '../format';
import { loadProfileStats, loadReviews } from '../store';
import { colors, radius } from '../theme';
import { ProfileStats, Review } from '../types';

type Props = {
  userId: string;
  onBack: () => void;
};

export default function UserScreen({ userId, onBack }: Props) {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([loadProfileStats(userId), loadReviews(userId)]).then(([nextStats, nextReviews]) => {
      if (!active) {
        return;
      }
      setStats(nextStats);
      setReviews(nextReviews);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <View>
      <Btn label="Back" onPress={onBack} color={colors.ink} small style={styles.back} />

      {loading ? (
        <EmptyCard title="Loading" copy="Fetching this person's record." />
      ) : !stats ? (
        <EmptyCard title="Profile unavailable" copy="This person's record could not be loaded." />
      ) : (
        <View>
          <Card style={styles.header}>
            <Text style={styles.name}>{stats.name}</Text>
            {stats.reviewCount > 0 ? (
              <View style={styles.ratingRow}>
                <StarRow rating={stats.avgRating} size={18} />
                <Text style={styles.ratingText}>
                  {`${stats.avgRating.toFixed(1)} from ${stats.reviewCount} ${
                    stats.reviewCount === 1 ? 'review' : 'reviews'
                  }`}
                </Text>
              </View>
            ) : (
              <Text style={styles.noRating}>No reviews yet. This person is new here.</Text>
            )}
            {stats.memberSince > 0 && <Text style={styles.since}>{`Joined ${timeLabel(stats.memberSince)}`}</Text>}

            <View style={styles.statsRow}>
              <Stat value={stats.jobsCompleted} label="Jobs done" />
              <Stat value={stats.jobsPosted} label="Jobs posted" />
              <Stat value={stats.reviewCount} label="Reviews" />
            </View>
          </Card>

          <SectionTitle>Reviews</SectionTitle>
          {reviews.length === 0 ? (
            <EmptyCard
              title="No reviews yet"
              copy="Reviews appear here once this person finishes a job with someone."
            />
          ) : (
            reviews.map((review) => (
              <Card key={review.id} style={styles.review}>
                <View style={styles.reviewTop}>
                  <Text style={styles.reviewer}>{review.raterName}</Text>
                  <Text style={styles.reviewDate}>{timeLabel(review.createdAt)}</Text>
                </View>
                <View style={styles.reviewStars}>
                  <StarRow rating={review.rating} />
                </View>
                {review.comment !== '' && <Text style={styles.comment}>{review.comment}</Text>}
              </Card>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    marginTop: 18,
    minWidth: 90,
  },
  header: {
    marginTop: 12,
  },
  name: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  ratingText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  noRating: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 8,
  },
  since: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  statValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  review: {
    marginTop: 10,
  },
  reviewTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewer: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 13,
  },
  reviewStars: {
    marginTop: 6,
  },
  comment: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
});
