import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Pill } from './src/components';
import DetailScreen from './src/screens/DetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import PostScreen from './src/screens/PostScreen';
import WorkerScreen from './src/screens/WorkerScreen';
import { loadJobs, persistLocal, remoteEnabled, reportJob, saveJobPatch, submitJob } from './src/store';
import { colors, radius } from './src/theme';
import { Job, JobDraft, Screen } from './src/types';

const SUBTITLES: Record<Screen, string> = {
  home: 'Local help, posted fast, picked up by nearby workers.',
  post: 'Post a clear request and get worker responses.',
  worker: 'Pick up nearby work and manage accepted jobs.',
  detail: 'Review the request before taking action.',
};

const NAV_ITEMS: Array<{ screen: Screen; label: string }> = [
  { screen: 'home', label: 'Home' },
  { screen: 'post', label: 'Post' },
  { screen: 'worker', label: 'Work' },
];

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [toast, setToast] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadJobs().then((loaded) => {
      setJobs(loaded);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (remoteEnabled && ready && (screen === 'home' || screen === 'worker')) {
      loadJobs().then(setJobs);
    }
  }, [screen, ready]);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  };

  const updateJobs = (next: Job[]) => {
    setJobs(next);
    if (!remoteEnabled) {
      void persistLocal(next);
    }
  };

  const patchJob = (id: string, patch: Partial<Job>) => {
    updateJobs(jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)));
    void saveJobPatch(id, patch);
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setScreen('detail');
  };

  const postJob = async (draft: JobDraft) => {
    const result = await submitJob(draft);
    if (result.verdict === 'rejected') {
      notify(`Not posted: ${result.reason}`);
      return;
    }
    updateJobs([result.job, ...jobs]);
    notify(result.verdict === 'pending' ? 'Submitted for review' : 'Job posted');
    openDetail(result.job.id);
  };

  const handleReport = (id: string, reason: string) => {
    void reportJob(id, reason);
    notify('Thanks. Our team will review this post.');
  };

  const acceptJob = (id: string) => {
    patchJob(id, { status: 'ACCEPTED', workerName: 'You', acceptedAt: Date.now() });
    notify('Job accepted');
    openDetail(id);
  };

  const startJob = (id: string) => {
    patchJob(id, { status: 'IN_PROGRESS' });
    notify('Job marked in progress');
  };

  const completeJob = (id: string) => {
    patchJob(id, { status: 'COMPLETED', completedAt: Date.now() });
    notify('Job completed');
  };

  const selectedJob = jobs.find((job) => job.id === selectedId);

  useEffect(() => {
    if (ready && screen === 'detail' && !selectedJob) {
      setScreen('home');
    }
  }, [ready, screen, selectedJob]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.brand}>Odd Jobs</Text>
              <Text style={styles.subtitle}>{SUBTITLES[screen]}</Text>
            </View>
            <Pill label="Pakistan" bg={colors.softBrand} color={colors.brand} />
          </View>

          {screen !== 'detail' && (
            <View style={styles.nav}>
              {NAV_ITEMS.map((item) => {
                const active = screen === item.screen;
                return (
                  <Pressable
                    key={item.screen}
                    onPress={() => setScreen(item.screen)}
                    style={[styles.navButton, active && styles.navButtonActive]}
                  >
                    <Text style={[styles.navLabel, { color: active ? colors.card : colors.ink }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {screen === 'home' && (
            <HomeScreen
              jobs={jobs}
              category={category}
              onCategory={setCategory}
              query={query}
              onQuery={setQuery}
              onOpen={openDetail}
              onGoPost={() => setScreen('post')}
            />
          )}
          {screen === 'post' && <PostScreen onSubmit={postJob} />}
          {screen === 'worker' && (
            <WorkerScreen
              jobs={jobs}
              category={category}
              onCategory={setCategory}
              onOpen={openDetail}
              onAccept={acceptJob}
            />
          )}
          {screen === 'detail' && selectedJob && (
            <DetailScreen
              job={selectedJob}
              onBack={() => setScreen('home')}
              onAccept={acceptJob}
              onStart={startJob}
              onComplete={completeJob}
              onReport={handleReport}
              notify={notify}
            />
          )}
        </ScrollView>

        {toast !== '' && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 560,
    paddingBottom: 28,
    paddingHorizontal: 18,
    paddingTop: 22,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerCopy: {
    flex: 1,
    paddingRight: 10,
  },
  brand: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
  nav: {
    backgroundColor: colors.navTrack,
    borderRadius: radius,
    flexDirection: 'row',
    marginTop: 18,
    padding: 4,
  },
  navButton: {
    alignItems: 'center',
    borderRadius: radius,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  navButtonActive: {
    backgroundColor: colors.ink,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  toast: {
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: radius,
    bottom: 32,
    marginHorizontal: 24,
    maxWidth: 480,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: 'absolute',
  },
  toastText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
});
