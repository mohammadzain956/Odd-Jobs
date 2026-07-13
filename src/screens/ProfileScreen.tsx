import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Btn, Card, EmptyCard, JobCard, Pill, SectionTitle, statusStyle } from '../components';
import { StarRow } from '../Stars';
import { remoteEnabled } from '../store';
import { colors } from '../theme';
import { AuthUser, Job, ProfileStats } from '../types';

type Props = {
  user: AuthUser | null;
  jobs: Job[];
  unread: Record<string, number>;
  saved: Record<string, boolean>;
  stats: ProfileStats | null;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenUser: (userId: string) => void;
  onGoLogin: () => void;
  onSignOut: () => void;
};

export default function ProfileScreen({
  user,
  jobs,
  unread,
  saved,
  stats,
  onOpen,
  onEdit,
  onDelete,
  onToggleSave,
  onOpenUser,
  onGoLogin,
  onSignOut,
}: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState('');

  if (remoteEnabled && !user) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Your account</Text>
        <Text style={styles.copy}>
          Log in to post jobs, accept work, and manage your posts. Your name is shown on everything you post.
        </Text>
        <Btn label="Log in or sign up" onPress={onGoLogin} style={styles.mainButton} />
      </Card>
    );
  }

  const myPosts = remoteEnabled ? jobs.filter((job) => job.createdBy === user?.id) : jobs;
  const savedJobs = jobs.filter((job) => saved[job.id]);

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      setConfirmDeleteId('');
      onDelete(id);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <View>
      <Card style={styles.card}>
        <Text style={styles.title}>{remoteEnabled ? user?.name : 'Offline mode'}</Text>
        <Text style={styles.copy}>
          {remoteEnabled
            ? user?.email
            : 'The app is not connected to the online backend yet, so posts live on this device only.'}
        </Text>
        {stats && stats.reviewCount > 0 ? (
          <View style={styles.ratingRow}>
            <StarRow rating={stats.avgRating} size={18} />
            <Text style={styles.ratingText}>
              {`${stats.avgRating.toFixed(1)} from ${stats.reviewCount} ${
                stats.reviewCount === 1 ? 'review' : 'reviews'
              }`}
            </Text>
          </View>
        ) : (
          remoteEnabled && <Text style={styles.noRating}>No reviews yet. Finish a job to start building a record.</Text>
        )}
        {stats && (
          <Text style={styles.counts}>
            {`${stats.jobsCompleted} ${stats.jobsCompleted === 1 ? 'job' : 'jobs'} done - ${stats.jobsPosted} posted`}
          </Text>
        )}
        {remoteEnabled && user && (
          <Btn
            label="View my public profile"
            onPress={() => onOpenUser(user.id)}
            outline
            small
            style={styles.mainButton}
          />
        )}
        {remoteEnabled && <Btn label="Sign out" onPress={onSignOut} outline small style={styles.signOut} />}
      </Card>

      <SectionTitle>My posts</SectionTitle>
      {myPosts.length === 0 ? (
        <EmptyCard title="No posts yet" copy="Jobs you post will show up here so you can manage them." />
      ) : (
        myPosts.map((job) => {
          const status = statusStyle(job.status);
          return (
            <Card key={job.id} style={styles.postCard}>
              <View style={styles.postTop}>
                <Text style={styles.postTitle}>{job.title}</Text>
                {(unread[job.id] ?? 0) > 0 && (
                  <Pill label={`${unread[job.id]} new`} bg={colors.action} color={colors.card} />
                )}
                <Pill label={status.label} bg={status.bg} color={status.fg} />
              </View>
              {job.moderationStatus === 'pending' && (
                <Text style={styles.pendingNote}>Held for review before it becomes visible to others.</Text>
              )}
              <View style={styles.postActions}>
                <Btn label="View" onPress={() => onOpen(job.id)} outline small style={styles.postButton} />
                <Btn label="Edit" onPress={() => onEdit(job.id)} outline small style={styles.postButton} />
                <Btn
                  label={confirmDeleteId === job.id ? 'Confirm?' : 'Delete'}
                  onPress={() => handleDelete(job.id)}
                  color={colors.action}
                  small
                  style={styles.postButton}
                />
              </View>
            </Card>
          );
        })
      )}

      <SectionTitle>Saved jobs</SectionTitle>
      {savedJobs.length === 0 ? (
        <EmptyCard title="Nothing saved yet" copy="Tap Save on a job to keep it here and come back to it later." />
      ) : (
        savedJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            workerMode={false}
            onOpen={onOpen}
            onAccept={onOpen}
            onToggleSave={onToggleSave}
            saved
            unread={unread[job.id] ?? 0}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '700',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  mainButton: {
    marginTop: 14,
  },
  signOut: {
    marginTop: 10,
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  ratingText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  noRating: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 10,
  },
  counts: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 6,
  },
  postCard: {
    marginTop: 10,
  },
  postTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  postTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  pendingNote: {
    color: colors.gold,
    fontSize: 13,
    marginTop: 6,
  },
  postActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  postButton: {
    flex: 1,
  },
});
