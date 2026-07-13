import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Btn, Bullet, Card, Field, Pill, statusStyle } from '../components';
import { StarPicker } from '../Stars';
import { locationLabel, money, timeLabel } from '../format';
import { colors, radius } from '../theme';
import { Job } from '../types';

const REPORT_REASONS = [
  'Scam or fraud',
  'Asking for advance payment',
  'Illegal item or activity',
  'Adult or sexual content',
  'Harassment or hate',
  'Misleading or spam',
  'Something else',
];

type Props = {
  job: Job;
  onBack: () => void;
  onAccept: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onReport: (id: string, reason: string) => void;
  onChat: (id: string) => void;
  onToggleSave: (id: string) => void;
  onOpenUser: (userId: string) => void;
  onReview: (id: string, rating: number, comment: string) => void;
  canReview: boolean;
  saved: boolean;
  unread: number;
};

export default function DetailScreen({
  job,
  onBack,
  onAccept,
  onStart,
  onComplete,
  onCancel,
  onReport,
  onChat,
  onToggleSave,
  onOpenUser,
  onReview,
  canReview,
  saved,
  unread,
}: Props) {
  const status = statusStyle(job.status);
  const [reporting, setReporting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const active = job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS';

  const sendReport = (reason: string) => {
    setReporting(false);
    onReport(job.id, reason);
  };

  return (
    <View>
      <Btn label="Back" onPress={onBack} color={colors.ink} small style={styles.back} />

      <Card style={styles.detail}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{job.title}</Text>
            <Text style={styles.meta}>{`${job.category} - ${job.urgency} - ${locationLabel(job)}`}</Text>
          </View>
          <Pill label={money(job.pay)} bg={colors.softBrand} color={colors.brand} />
        </View>

        <View style={styles.badgeRow}>
          <Pill label={status.label} bg={status.bg} color={status.fg} />
          {job.moderationStatus === 'pending' && <Pill label="In review" bg={colors.softGold} color={colors.gold} />}
          {job.featured && <Pill label="Featured" bg={colors.softGold} color={colors.gold} />}
        </View>

        <View style={styles.infoBlock}>
          <InfoRow label="Location" value={locationLabel(job)} />
          <PersonRow
            label="Posted by"
            name={job.requesterName}
            userId={job.createdBy}
            onOpenUser={onOpenUser}
          />
          {job.workerName !== '' && (
            <PersonRow label="Worker" name={job.workerName} userId={job.acceptedBy} onOpenUser={onOpenUser} />
          )}
          <InfoRow label="Posted" value={timeLabel(job.createdAt)} />
        </View>

        {job.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {job.photos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </ScrollView>
        )}

        <Text style={styles.descriptionTitle}>Description</Text>
        <Text style={styles.description}>{job.details}</Text>

        <View style={styles.actions}>
          {job.status === 'OPEN' && <Btn label="Accept job" onPress={() => onAccept(job.id)} color={colors.action} />}
          {job.status === 'ACCEPTED' && <Btn label="Start work" onPress={() => onStart(job.id)} />}
          {job.status === 'IN_PROGRESS' && <Btn label="Mark complete" onPress={() => onComplete(job.id)} />}
          {active && (
            <Btn
              label={confirmCancel ? 'Confirm: re-open this job?' : 'Cancel job'}
              onPress={() => {
                if (confirmCancel) {
                  setConfirmCancel(false);
                  onCancel(job.id);
                } else {
                  setConfirmCancel(true);
                }
              }}
              color={colors.action}
              outline={!confirmCancel}
              small
            />
          )}
          {confirmCancel && (
            <Text style={styles.cancelNote}>
              The job goes back to the open list for other workers, and the chat for this job is cleared.
            </Text>
          )}
          <View style={styles.secondaryRow}>
            <Btn
              label={unread > 0 ? `Chat (${unread} new)` : 'Chat'}
              onPress={() => onChat(job.id)}
              color={colors.action}
              outline={unread === 0}
              small
              style={styles.secondaryBtn}
            />
            <Btn
              label={saved ? 'Saved' : 'Save'}
              onPress={() => onToggleSave(job.id)}
              color={colors.brand}
              outline={!saved}
              small
              style={styles.secondaryBtn}
            />
            <Btn
              label="Report"
              onPress={() => setReporting(true)}
              outline
              small
              style={styles.secondaryBtn}
            />
          </View>
        </View>

        {canReview && (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>How did it go?</Text>
            <Text style={styles.reviewNote}>
              Your rating is public and helps the next person decide who to work with. It cannot be changed later.
            </Text>
            <View style={styles.picker}>
              <StarPicker value={rating} onChange={setRating} />
            </View>
            <Field
              placeholder="Add a comment (optional)"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={500}
            />
            <Btn
              label={rating === 0 ? 'Pick a rating' : 'Submit review'}
              onPress={() => {
                if (rating > 0) {
                  onReview(job.id, rating, comment.trim());
                }
              }}
              style={styles.reviewSubmit}
            />
          </View>
        )}

        {reporting && (
          <View style={styles.reportBox}>
            <Text style={styles.reportTitle}>Why are you reporting this post?</Text>
            <Text style={styles.reportNote}>
              Report posts that break the rules. If the pay is too low or a deal fell through, just skip the job
              instead of reporting it.
            </Text>
            {REPORT_REASONS.map((reason) => (
              <Btn key={reason} label={reason} onPress={() => sendReport(reason)} outline small style={styles.reportOption} />
            ))}
            <Btn label="Cancel" onPress={() => setReporting(false)} color={colors.ink} small style={styles.reportOption} />
          </View>
        )}
      </Card>

      <Card style={styles.safety}>
        <Text style={styles.safetyTitle}>Safety reminders</Text>
        <Bullet>Confirm details in chat before going to the job.</Bullet>
        <Bullet>Do not send advance money outside the app.</Bullet>
        <Bullet>Report suspicious users or unclear requests.</Bullet>
      </Card>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// A named participant, tappable to see their public record. Falls back to plain
// text for older posts that have no account attached to them.
function PersonRow({
  label,
  name,
  userId,
  onOpenUser,
}: {
  label: string;
  name: string;
  userId: string;
  onOpenUser: (userId: string) => void;
}) {
  if (!userId) {
    return <InfoRow label={label} value={name} />;
  }
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Pressable onPress={() => onOpenUser(userId)} style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.personLink}>{`${name} - view profile`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    marginTop: 18,
    minWidth: 90,
  },
  detail: {
    marginTop: 12,
  },
  titleRow: {
    flexDirection: 'row',
  },
  titleBlock: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  infoBlock: {
    gap: 8,
    marginTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
  },
  photoRow: {
    marginTop: 16,
  },
  photo: {
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    height: 140,
    marginRight: 10,
    width: 140,
  },
  descriptionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  description: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
  cancelNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
  },
  personLink: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.6,
  },
  reviewBox: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 16,
  },
  reviewTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  reviewNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  picker: {
    alignItems: 'center',
    marginTop: 12,
  },
  reviewSubmit: {
    marginTop: 12,
  },
  reportBox: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 16,
  },
  reportTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  reportNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  reportOption: {
    marginTop: 8,
  },
  safety: {
    marginTop: 16,
  },
  safetyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
});
