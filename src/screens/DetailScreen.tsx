import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Btn, Bullet, Card, Pill, statusStyle } from '../components';
import { money, timeLabel } from '../format';
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
  onReport: (id: string, reason: string) => void;
  notify: (message: string) => void;
};

export default function DetailScreen({ job, onBack, onAccept, onStart, onComplete, onReport, notify }: Props) {
  const status = statusStyle(job.status);
  const [reporting, setReporting] = useState(false);

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
            <Text style={styles.meta}>{`${job.category} - ${job.urgency} - ${job.distance}`}</Text>
          </View>
          <Pill label={money(job.pay)} bg={colors.softBrand} color={colors.brand} />
        </View>

        <View style={styles.badgeRow}>
          <Pill label={status.label} bg={status.bg} color={status.fg} />
          {job.moderationStatus === 'pending' && <Pill label="In review" bg={colors.softGold} color={colors.gold} />}
          {job.featured && <Pill label="Featured" bg={colors.softGold} color={colors.gold} />}
        </View>

        <View style={styles.infoBlock}>
          <InfoRow label="Location" value={job.location} />
          <InfoRow label="Posted by" value={job.requesterName} />
          <InfoRow label="Posted" value={timeLabel(job.createdAt)} />
        </View>

        {job.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {job.photos.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.photo} />
            ))}
          </ScrollView>
        )}

        <View style={styles.map}>
          <Text style={styles.mapText}>{`Map preview - ${job.location}`}</Text>
        </View>

        <Text style={styles.descriptionTitle}>Description</Text>
        <Text style={styles.description}>{job.details}</Text>

        <View style={styles.actions}>
          {job.status === 'OPEN' && <Btn label="Accept job" onPress={() => onAccept(job.id)} color={colors.action} />}
          {job.status === 'ACCEPTED' && <Btn label="Start work" onPress={() => onStart(job.id)} />}
          {job.status === 'IN_PROGRESS' && <Btn label="Mark complete" onPress={() => onComplete(job.id)} />}
          <View style={styles.secondaryRow}>
            <Btn
              label="Chat"
              onPress={() => notify('Chat preview coming next')}
              outline
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
  map: {
    alignItems: 'center',
    backgroundColor: colors.mapFill,
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 86,
  },
  mapText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
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
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
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
