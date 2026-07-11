import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Btn, Bullet, Card, ChipRow, Field } from '../components';
import { parsePay } from '../format';
import { colors, radius } from '../theme';
import { CATEGORIES, Job, JobDraft, URGENCIES } from '../types';

type Props = {
  onSubmit: (draft: JobDraft) => Promise<void>;
  initial?: Job;
  accountName?: string;
};

const MAX_PHOTOS = 5;

export default function PostScreen({ onSubmit, initial, accountName }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [details, setDetails] = useState(initial?.details ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [pay, setPay] = useState(initial ? String(initial.pay) : '');
  const [category, setCategory] = useState<string>(initial?.category ?? CATEGORIES[0]);
  const [urgency, setUrgency] = useState<string>(initial?.urgency ?? URGENCIES[0]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [requester, setRequester] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; details?: string; location?: string; pay?: string }>({});

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.7,
    });
    if (!result.canceled) {
      const picked = result.assets.map((asset) => asset.uri);
      setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos((current) => current.filter((photo) => photo !== uri));
  };

  const submit = async () => {
    if (submitting) {
      return;
    }
    const parsedPay = parsePay(pay);
    const nextErrors: typeof errors = {};
    if (!title.trim()) {
      nextErrors.title = 'Required';
    }
    if (!details.trim()) {
      nextErrors.details = 'Required';
    }
    if (!location.trim()) {
      nextErrors.location = 'Required';
    }
    if (parsedPay <= 0) {
      nextErrors.pay = 'Enter a fair amount';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        details: details.trim(),
        location: location.trim(),
        pay: parsedPay,
        category,
        urgency,
        featured,
        photos: initial ? initial.photos : photos,
        requesterName: accountName ?? (requester.trim() || 'Customer'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <Card style={styles.form}>
        <Text style={styles.title}>{initial ? 'Edit your post' : 'Post a job'}</Text>
        <Text style={styles.helper}>
          {initial
            ? 'Update the details below. Photos stay as they are.'
            : 'Use a short title, fair pay, real photos, and a clear area so workers can decide quickly.'}
        </Text>

        <Field placeholder="Job title" value={title} onChangeText={setTitle} error={errors.title} />
        <Field
          placeholder="Describe the work"
          value={details}
          onChangeText={setDetails}
          multiline
          error={errors.details}
        />
        <Field placeholder="Area or location" value={location} onChangeText={setLocation} error={errors.location} />
        <Field
          placeholder="Budget in Rs"
          value={pay}
          onChangeText={setPay}
          keyboardType="numeric"
          error={errors.pay}
        />

        <Text style={styles.fieldLabel}>Category</Text>
        <ChipRow options={CATEGORIES} selected={category} onSelect={setCategory} />

        <Text style={styles.fieldLabel}>Urgency</Text>
        <ChipRow options={URGENCIES} selected={urgency} onSelect={setUrgency} />

        {!initial && <Text style={styles.fieldLabel}>Photos</Text>}
        {!initial && photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
            {photos.map((uri) => (
              <Pressable key={uri} onPress={() => removePhoto(uri)}>
                <Image source={{ uri }} style={styles.photo} />
                <Text style={styles.photoRemove}>Tap to remove</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {!initial && photos.length < MAX_PHOTOS && (
          <Btn
            label={photos.length === 0 ? 'Add photos' : `Add more (${photos.length}/${MAX_PHOTOS})`}
            onPress={() => void pickPhotos()}
            outline
            small
            style={styles.photoButton}
          />
        )}

        <View style={styles.featureRow}>
          <Text style={styles.featureLabel}>Feature this job</Text>
          <Switch
            value={featured}
            onValueChange={setFeatured}
            trackColor={{ true: colors.brand, false: colors.line }}
          />
        </View>

        {!accountName && !initial && <Field placeholder="Your name" value={requester} onChangeText={setRequester} />}

        <Btn
          label={submitting ? 'Saving...' : initial ? 'Save changes' : 'Post now'}
          onPress={() => void submit()}
          style={styles.submit}
        />
      </Card>

      <Card style={styles.tips}>
        <Text style={styles.tipsTitle}>Posting checks</Text>
        <Bullet>Use one clear job per post.</Bullet>
        <Bullet>Avoid asking for advance payments outside the app.</Bullet>
        <Bullet>Set a realistic budget to get better worker responses.</Bullet>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '700',
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
  },
  photoRow: {
    marginTop: 10,
  },
  photo: {
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    height: 96,
    marginRight: 10,
    width: 96,
  },
  photoRemove: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  photoButton: {
    marginTop: 10,
  },
  featureRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  featureLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  submit: {
    marginTop: 16,
  },
  tips: {
    marginTop: 16,
  },
  tipsTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
});
