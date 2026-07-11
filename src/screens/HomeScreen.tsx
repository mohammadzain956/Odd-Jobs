import { StyleSheet, Text, View } from 'react-native';
import { Btn, Card, ChipRow, CityRow, EmptyCard, Field, JobCard, SectionTitle } from '../components';
import { matchesFilters } from '../store';
import { colors, radius } from '../theme';
import { CATEGORY_FILTERS, Job } from '../types';

type Props = {
  jobs: Job[];
  category: string;
  onCategory: (category: string) => void;
  city: string;
  onCity: (city: string) => void;
  area: string;
  onArea: (area: string) => void;
  onNearMe: () => void;
  query: string;
  onQuery: (query: string) => void;
  onOpen: (id: string) => void;
  onGoPost: () => void;
  unread: Record<string, number>;
};

export default function HomeScreen({
  jobs,
  category,
  onCategory,
  city,
  onCity,
  area,
  onArea,
  onNearMe,
  query,
  onQuery,
  onOpen,
  onGoPost,
  unread,
}: Props) {
  const visible = jobs.filter((job) => matchesFilters(job, category, query, city, area));
  const featured = visible.filter((job) => job.featured);
  const openCount = jobs.filter((job) => job.status === 'OPEN').length;
  const acceptedCount = jobs.filter((job) => job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS').length;
  const doneCount = jobs.filter((job) => job.status === 'COMPLETED').length;

  return (
    <View>
      <Card style={styles.hero}>
        <Text style={styles.heroTitle}>Find help or browse work</Text>
        <Text style={styles.heroCopy}>
          Search jobs by title, category, or area. Featured and urgent requests appear first.
        </Text>
        <Field placeholder="Search jobs" value={query} onChangeText={onQuery} returnKeyType="search" />
        <Btn label="Post a job request" onPress={onGoPost} color={colors.action} style={styles.cta} />
      </Card>

      <CityRow value={city} onChange={onCity} area={area} onArea={onArea} onNearMe={onNearMe} />

      <ChipRow options={CATEGORY_FILTERS} selected={category} onSelect={onCategory} />

      <View style={styles.statsRow}>
        <Stat value={openCount} label="Open" />
        <Stat value={acceptedCount} label="Accepted" />
        <Stat value={doneCount} label="Done" />
      </View>

      {featured.length > 0 && (
        <View>
          <SectionTitle>Featured nearby</SectionTitle>
          {featured.map((job) => (
            <JobCard key={job.id} job={job} workerMode={false} onOpen={onOpen} onAccept={onOpen} unread={unread[job.id] ?? 0} />
          ))}
        </View>
      )}

      <SectionTitle>Latest requests</SectionTitle>
      {visible.length === 0 ? (
        <EmptyCard title="No matching jobs" copy="Try another category or clear the search." />
      ) : (
        visible.map((job) => (
          <JobCard key={job.id} job={job} workerMode={false} onOpen={onOpen} onAccept={onOpen} unread={unread[job.id] ?? 0} />
        ))
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
  hero: {
    marginTop: 18,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  cta: {
    marginTop: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: colors.card,
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
});
