import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Btn, Card, EmptyCard, Field, Pill, SectionTitle } from '../components';
import { locationLabel, money, shorten, timeLabel } from '../format';
import { approveJob, dismissReport, loadPendingJobs, loadReports, rejectJob } from '../store';
import { colors } from '../theme';
import { AdminReport, Job } from '../types';

type Props = {
  jobs: Job[];
  onOpen: (id: string) => void;
  onChanged: () => void;
  notify: (message: string) => void;
};

export default function AdminScreen({ jobs, onOpen, onChanged, notify }: Props) {
  const [pending, setPending] = useState<Job[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    Promise.all([loadPendingJobs(), loadReports()]).then(([nextPending, nextReports]) => {
      setPending(nextPending);
      setReports(nextReports);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleApprove = async (id: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    const result = await approveJob(id);
    setBusy(false);
    notify(result.ok ? 'Post approved and now public' : (result.message ?? 'Could not approve the post.'));
    refresh();
    onChanged();
  };

  const handleReject = async (id: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    const result = await rejectJob(id, rejectReason.trim());
    setBusy(false);
    setRejectingId('');
    setRejectReason('');
    notify(result.ok ? 'Post rejected and removed' : (result.message ?? 'Could not reject the post.'));
    refresh();
    onChanged();
  };

  const handleDismiss = async (id: string) => {
    if (busy) {
      return;
    }
    setBusy(true);
    const result = await dismissReport(id);
    setBusy(false);
    notify(result.ok ? 'Report cleared' : (result.message ?? 'Could not clear the report.'));
    refresh();
  };

  return (
    <View>
      <Card style={styles.intro}>
        <Text style={styles.title}>Moderation</Text>
        <Text style={styles.copy}>
          Posts held by moderation wait here until you approve or reject them. Reports from users land below.
          Every decision is kept on record.
        </Text>
      </Card>

      <SectionTitle>Pending posts</SectionTitle>
      {loading ? (
        <EmptyCard title="Loading" copy="Fetching the moderation queue." />
      ) : pending.length === 0 ? (
        <EmptyCard title="Nothing waiting" copy="New posts held for review will show up here." />
      ) : (
        pending.map((job) => (
          <Card key={job.id} style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTitle}>{job.title}</Text>
              <Pill label={money(job.pay)} bg={colors.softBrand} color={colors.brand} />
            </View>
            <Text style={styles.itemMeta}>
              {`${job.category} - ${locationLabel(job)} - by ${job.requesterName} - ${timeLabel(job.createdAt)}`}
            </Text>
            <Text style={styles.itemBody}>{shorten(job.details, 220)}</Text>
            {rejectingId === job.id ? (
              <View>
                <Field
                  placeholder="Why is this post being rejected? (kept on record)"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                />
                <View style={styles.actions}>
                  <Btn
                    label="Confirm reject"
                    onPress={() => void handleReject(job.id)}
                    color={colors.action}
                    small
                    style={styles.actionBtn}
                  />
                  <Btn
                    label="Keep it"
                    onPress={() => {
                      setRejectingId('');
                      setRejectReason('');
                    }}
                    outline
                    small
                    style={styles.actionBtn}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                <Btn
                  label="Approve"
                  onPress={() => void handleApprove(job.id)}
                  small
                  style={styles.actionBtn}
                />
                <Btn
                  label="Reject"
                  onPress={() => setRejectingId(job.id)}
                  color={colors.action}
                  outline
                  small
                  style={styles.actionBtn}
                />
              </View>
            )}
          </Card>
        ))
      )}

      <SectionTitle>Reports</SectionTitle>
      {loading ? (
        <EmptyCard title="Loading" copy="Fetching user reports." />
      ) : reports.length === 0 ? (
        <EmptyCard title="No open reports" copy="When someone reports a post, it lands here." />
      ) : (
        reports.map((report) => {
          const jobLoaded = jobs.some((job) => job.id === report.jobId);
          return (
            <Card key={report.id} style={styles.item}>
              <Text style={styles.itemTitle}>{report.jobTitle}</Text>
              <Text style={styles.itemMeta}>{`Reported ${timeLabel(report.createdAt)}`}</Text>
              <Text style={styles.itemBody}>{report.reason || 'No reason given.'}</Text>
              <View style={styles.actions}>
                {jobLoaded && (
                  <Btn
                    label="View post"
                    onPress={() => onOpen(report.jobId)}
                    outline
                    small
                    style={styles.actionBtn}
                  />
                )}
                <Btn
                  label="Dismiss"
                  onPress={() => void handleDismiss(report.id)}
                  color={colors.ink}
                  small
                  style={styles.actionBtn}
                />
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
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
  item: {
    marginTop: 10,
  },
  itemTop: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  itemTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  itemBody: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
  },
});
