import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { locationLabel, money, shorten, timeLabel } from './format';
import { CITY_NAMES } from './locations';
import { colors, radius } from './theme';
import { Job, JobStatus } from './types';

export function statusStyle(status: JobStatus): { bg: string; fg: string; label: string } {
  switch (status) {
    case 'ACCEPTED':
      return { bg: colors.softAction, fg: colors.action, label: 'Accepted' };
    case 'IN_PROGRESS':
      return { bg: colors.softGold, fg: colors.gold, label: 'In progress' };
    case 'COMPLETED':
      return { bg: colors.softGrey, fg: colors.muted, label: 'Completed' };
    default:
      return { bg: colors.softBrand, fg: colors.brand, label: 'Open' };
  }
}

export function urgencyStyle(urgency: string): { bg: string; fg: string } {
  if (urgency === 'Today') {
    return { bg: colors.softAction, fg: colors.action };
  }
  if (urgency === 'This week') {
    return { bg: colors.softGold, fg: colors.gold };
  }
  return { bg: colors.softGrey, fg: colors.muted };
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function Btn({
  label,
  onPress,
  color = colors.brand,
  outline = false,
  small = false,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  outline?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small ? styles.btnSmall : styles.btnLarge,
        outline ? styles.btnOutline : { backgroundColor: color },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.btnText, small && styles.btnTextSmall, outline && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ error, style, ...props }: TextInputProps & { error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.field, props.multiline && styles.fieldMultiline, error != null && styles.fieldError, style]}
        {...props}
      />
      {error != null && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
          >
            <Text style={[styles.chipText, { color: active ? colors.card : colors.ink }]}>{option}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function CityRow({
  value,
  onChange,
  onNearMe,
}: {
  value: string;
  onChange: (city: string) => void;
  onNearMe: () => void;
}) {
  const options = ['All Pakistan', ...CITY_NAMES];
  return (
    <View>
      <ChipRow
        options={options}
        selected={value === 'All' ? 'All Pakistan' : value}
        onSelect={(picked) => onChange(picked === 'All Pakistan' ? 'All' : picked)}
      />
      <Btn label="Near me" onPress={onNearMe} outline small style={styles.nearMe} />
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Bullet({ children }: { children: string }) {
  return <Text style={styles.bullet}>{'• ' + children}</Text>;
}

export function EmptyCard({ title, copy }: { title: string; copy: string }) {
  return (
    <Card style={styles.gapTop}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </Card>
  );
}

export function JobCard({
  job,
  workerMode,
  onOpen,
  onAccept,
  unread = 0,
}: {
  job: Job;
  workerMode: boolean;
  onOpen: (id: string) => void;
  onAccept: (id: string) => void;
  unread?: number;
}) {
  const status = statusStyle(job.status);
  const urgency = urgencyStyle(job.urgency);
  return (
    <Pressable onPress={() => onOpen(job.id)}>
      <Card style={styles.gapTop}>
        <View style={styles.jobTop}>
          <View style={styles.jobTitleBlock}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobMeta}>{`${job.category} - ${locationLabel(job)} - ${timeLabel(job.createdAt)}`}</Text>
          </View>
          <Pill label={money(job.pay)} bg={colors.softBrand} color={colors.brand} />
        </View>
        <Text style={styles.jobDetails}>{shorten(job.details, 120)}</Text>
        <View style={styles.badgeRow}>
          {unread > 0 && <Pill label={`${unread} new`} bg={colors.action} color={colors.card} />}
          <Pill label={status.label} bg={status.bg} color={status.fg} />
          <Pill label={job.urgency} bg={urgency.bg} color={urgency.fg} />
          {job.moderationStatus === 'pending' && <Pill label="In review" bg={colors.softGold} color={colors.gold} />}
          {job.featured && <Pill label="Featured" bg={colors.softGold} color={colors.gold} />}
        </View>
        <View style={styles.actionRow}>
          <Btn label="Details" onPress={() => onOpen(job.id)} outline small style={styles.actionBtn} />
          {workerMode && job.status === 'OPEN' && (
            <Btn label="Accept" onPress={() => onAccept(job.id)} color={colors.action} small style={styles.actionBtn} />
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    padding: 16,
  },
  gapTop: {
    marginTop: 10,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  btn: {
    alignItems: 'center',
    borderRadius: radius,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  btnLarge: {
    minHeight: 52,
  },
  btnSmall: {
    minHeight: 46,
  },
  btnOutline: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
  },
  btnText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
  btnTextSmall: {
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  fieldWrap: {
    marginTop: 10,
  },
  field: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  fieldMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  fieldError: {
    borderColor: colors.action,
  },
  errorText: {
    color: colors.action,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  chipRow: {
    marginTop: 16,
  },
  nearMe: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minWidth: 110,
  },
  chip: {
    borderRadius: radius,
    justifyContent: 'center',
    marginRight: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.brand,
  },
  chipIdle: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
  },
  bullet: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 3,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '700',
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
  },
  jobTop: {
    flexDirection: 'row',
  },
  jobTitleBlock: {
    flex: 1,
    paddingRight: 10,
  },
  jobTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  jobMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  jobDetails: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
  },
});
