import { StyleSheet, Text, View } from 'react-native';
import { Card, ChipRow, CityRow, EmptyCard, JobCard, Pill, SectionTitle } from '../components';
import { StarRow } from '../Stars';
import { money } from '../format';
import { matchesFilters } from '../store';
import { colors } from '../theme';
import { CATEGORY_FILTERS, Job, ProfileStats } from '../types';

type Props = {
  jobs: Job[];
  category: string;
  onCategory: (category: string) => void;
  city: string;
  onCity: (city: string) => void;
  area: string;
  onArea: (area: string) => void;
  onNearMe: () => void;
  onOpen: (id: string) => void;
  onAccept: (id: string) => void;
  onToggleSave: (id: string) => void;
  saved: Record<string, boolean>;
  unread: Record<string, number>;
  stats: ProfileStats | null;
};

export default function WorkerScreen({
  jobs,
  category,
  onCategory,
  city,
  onCity,
  area,
  onArea,
  onNearMe,
  onOpen,
  onAccept,
  onToggleSave,
  saved,
  unread,
  stats,
}: Props) {
  const openJobs = jobs.filter((job) => job.status === 'OPEN');
  const openVisible = openJobs.filter((job) => matchesFilters(job, category, '', city, area));
  const acceptedJobs = jobs.filter((job) => job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS');
  const totalOpenPay = openJobs.reduce((sum, job) => sum + job.pay, 0);

  return (
    <View>
      <Card style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Worker board</Text>
            <Text style={styles.summaryMeta}>{`${openJobs.length} open jobs worth ${money(totalOpenPay)}`}</Text>
          </View>
          {/* This badge reflects the real record. It used to read "Verified worker"
              for everyone, which claimed a verification that does not exist. */}
          {stats && stats.jobsCompleted > 0 ? (
            <Pill
              label={`${stats.jobsCompleted} ${stats.jobsCompleted === 1 ? 'job' : 'jobs'} done`}
              bg={colors.softBrand}
              color={colors.brand}
            />
          ) : (
            <Pill label="New worker" bg={colors.softGrey} color={colors.muted} />
          )}
        </View>
        {stats && stats.reviewCount > 0 && (
          <View style={styles.ratingRow}>
            <StarRow rating={stats.avgRating} />
            <Text style={styles.ratingText}>
              {`${stats.avgRating.toFixed(1)} from ${stats.reviewCount} ${
                stats.reviewCount === 1 ? 'review' : 'reviews'
              }`}
            </Text>
          </View>
        )}
        <Text style={styles.note}>
          Pick jobs with clear pay, location, and instructions. Open the detail page before accepting.
        </Text>
      </Card>

      <CityRow value={city} onChange={onCity} area={area} onArea={onArea} onNearMe={onNearMe} />

      <ChipRow options={CATEGORY_FILTERS} selected={category} onSelect={onCategory} />

      <SectionTitle>Open requests</SectionTitle>
      {openVisible.length === 0 ? (
        <EmptyCard title="No open work here" copy="Try another category or check back later." />
      ) : (
        openVisible.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            workerMode
            onOpen={onOpen}
            onAccept={onAccept}
            onToggleSave={onToggleSave}
            saved={saved[job.id] ?? false}
            unread={unread[job.id] ?? 0}
          />
        ))
      )}

      {acceptedJobs.length > 0 && (
        <View>
          <SectionTitle>Your accepted jobs</SectionTitle>
          {acceptedJobs.map((job) => (
            <JobCard key={job.id} job={job} workerMode onOpen={onOpen} onAccept={onAccept} unread={unread[job.id] ?? 0} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    marginTop: 18,
  },
  summaryTop: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  summaryCopy: {
    flex: 1,
    paddingRight: 10,
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '700',
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  ratingText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  note: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
});
