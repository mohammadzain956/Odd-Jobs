import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Pill } from './src/components';
import AuthScreen from './src/screens/AuthScreen';
import ChatScreen from './src/screens/ChatScreen';
import DetailScreen from './src/screens/DetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import PostScreen from './src/screens/PostScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import WorkerScreen from './src/screens/WorkerScreen';
import {
  deleteJob,
  getSessionUser,
  loadJobs,
  loadUnreadCounts,
  markChatRead,
  persistLocal,
  remoteEnabled,
  reportJob,
  saveJobPatch,
  signOutUser,
  submitJob,
  subscribeToInbox,
  updateJobFields,
} from './src/store';
import { detectCity } from './src/location';
import { colors, radius } from './src/theme';
import { AuthUser, Job, JobDraft, Screen } from './src/types';

const SUBTITLES: Record<Screen, string> = {
  home: 'Local help, posted fast, picked up by nearby workers.',
  post: 'Post a clear request and get worker responses.',
  worker: 'Pick up nearby work and manage accepted jobs.',
  detail: 'Review the request before taking action.',
  profile: 'Your account and the posts you manage.',
  auth: 'Log in or create your account.',
  chat: 'Sort out the details together.',
};

const NAV_ITEMS: Array<{ screen: Screen; label: string }> = [
  { screen: 'home', label: 'Home' },
  { screen: 'post', label: 'Post' },
  { screen: 'worker', label: 'Work' },
  { screen: 'profile', label: 'Profile' },
];

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [category, setCategory] = useState('All');
  const [cityFilter, setCityFilter] = useState('All');
  const [areaFilter, setAreaFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [toast, setToast] = useState('');
  const [unread, setUnread] = useState<Record<string, number>>({});
  const scrollRef = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afterAuth = useRef<Screen>('home');
  const activeChatId = useRef('');

  useEffect(() => {
    Promise.all([loadJobs(), getSessionUser()]).then(([loaded, sessionUser]) => {
      setJobs(loaded);
      setUser(sessionUser);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    activeChatId.current = screen === 'chat' ? selectedId : '';
    if (remoteEnabled && ready && (screen === 'home' || screen === 'worker' || screen === 'profile')) {
      loadJobs().then(setJobs);
      if (user) {
        loadUnreadCounts().then(setUnread);
      }
    }
  }, [screen, ready, selectedId, user?.id]);

  useEffect(() => {
    if (!remoteEnabled || !user) {
      return;
    }
    loadUnreadCounts().then(setUnread);
    const unsubscribe = subscribeToInbox((message) => {
      if (message.senderId === user.id || activeChatId.current === message.jobId) {
        return;
      }
      setUnread((current) => ({ ...current, [message.jobId]: (current[message.jobId] ?? 0) + 1 }));
      notify(`New message from ${message.senderName}`);
    });
    return unsubscribe;
  }, [user?.id]);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  };

  const requireLogin = (destination: Screen, message: string): boolean => {
    if (remoteEnabled && !user) {
      afterAuth.current = destination;
      setScreen('auth');
      notify(message);
      return true;
    }
    return false;
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

  const openNav = (destination: Screen) => {
    if (destination === 'post') {
      setEditingId('');
      if (requireLogin('post', 'Log in to post a job')) {
        return;
      }
    }
    setScreen(destination);
  };

  const postJob = async (draft: JobDraft) => {
    if (editingId) {
      updateJobs(jobs.map((job) => (job.id === editingId ? { ...job, ...draft } : job)));
      void updateJobFields(editingId, draft);
      notify('Post updated');
      const id = editingId;
      setEditingId('');
      openDetail(id);
      return;
    }
    const result = await submitJob(draft);
    if (result.verdict === 'rejected') {
      notify(`Not posted: ${result.reason}`);
      return;
    }
    updateJobs([result.job, ...jobs]);
    notify(result.verdict === 'pending' ? 'Submitted for review' : 'Job posted');
    openDetail(result.job.id);
  };

  const acceptJob = (id: string) => {
    if (requireLogin(screen, 'Log in to accept jobs')) {
      return;
    }
    patchJob(id, {
      status: 'ACCEPTED',
      workerName: user?.name ?? 'You',
      acceptedBy: user?.id ?? '',
      acceptedAt: Date.now(),
    });
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

  const handleReport = (id: string, reason: string) => {
    void reportJob(id, reason);
    notify('Thanks. Our team will review this post.');
  };

  const changeCityFilter = (city: string) => {
    setCityFilter(city);
    setAreaFilter('All');
  };

  const handleNearMe = async () => {
    notify('Finding your city...');
    const city = await detectCity();
    if (city) {
      changeCityFilter(city);
      notify(`Showing jobs in ${city}`);
    } else {
      notify('Could not detect your city here. Pick it from the list.');
    }
  };

  const handleChat = (id: string) => {
    if (!remoteEnabled) {
      notify('Chat needs the online backend');
      return;
    }
    if (requireLogin('detail', 'Log in to chat')) {
      return;
    }
    const job = jobs.find((j) => j.id === id);
    if (!job) {
      return;
    }
    if (job.status === 'OPEN') {
      notify('Chat opens once a worker accepts the job');
      return;
    }
    if (user && job.createdBy !== user.id && job.acceptedBy !== user.id) {
      notify('Chat is private between the poster and the worker');
      return;
    }
    setUnread((current) => ({ ...current, [id]: 0 }));
    void markChatRead(id);
    setSelectedId(id);
    setScreen('chat');
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setScreen('post');
  };

  const handleDelete = (id: string) => {
    updateJobs(jobs.filter((job) => job.id !== id));
    void deleteJob(id);
    notify('Post deleted');
  };

  const handleSignOut = () => {
    void signOutUser();
    setUser(null);
    notify('Signed out');
  };

  const handleAuthDone = (signedIn: AuthUser) => {
    setUser(signedIn);
    setScreen(afterAuth.current);
    afterAuth.current = 'home';
    notify(`Welcome, ${signedIn.name}`);
  };

  const selectedJob = jobs.find((job) => job.id === selectedId);
  const editingJob = jobs.find((job) => job.id === editingId);

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
            <Pill
              label={
                cityFilter === 'All'
                  ? 'Pakistan'
                  : areaFilter === 'All'
                    ? cityFilter
                    : `${areaFilter}, ${cityFilter}`
              }
              bg={colors.softBrand}
              color={colors.brand}
            />
          </View>

          {screen !== 'detail' && screen !== 'chat' && (
            <View style={styles.nav}>
              {NAV_ITEMS.map((item) => {
                const active = screen === item.screen;
                return (
                  <Pressable
                    key={item.screen}
                    onPress={() => openNav(item.screen)}
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
              city={cityFilter}
              onCity={changeCityFilter}
              area={areaFilter}
              onArea={setAreaFilter}
              onNearMe={() => void handleNearMe()}
              query={query}
              onQuery={setQuery}
              onOpen={openDetail}
              onGoPost={() => openNav('post')}
              unread={unread}
            />
          )}
          {screen === 'post' && (
            <PostScreen
              key={editingId || 'new'}
              onSubmit={postJob}
              initial={editingJob}
              accountName={user?.name}
            />
          )}
          {screen === 'worker' && (
            <WorkerScreen
              jobs={jobs}
              category={category}
              onCategory={setCategory}
              city={cityFilter}
              onCity={changeCityFilter}
              area={areaFilter}
              onArea={setAreaFilter}
              onNearMe={() => void handleNearMe()}
              onOpen={openDetail}
              onAccept={acceptJob}
              unread={unread}
            />
          )}
          {screen === 'profile' && (
            <ProfileScreen
              user={user}
              jobs={jobs}
              unread={unread}
              onOpen={openDetail}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGoLogin={() => {
                afterAuth.current = 'profile';
                setScreen('auth');
              }}
              onSignOut={handleSignOut}
            />
          )}
          {screen === 'auth' && <AuthScreen onDone={handleAuthDone} notify={notify} />}
          {screen === 'detail' && selectedJob && (
            <DetailScreen
              job={selectedJob}
              onBack={() => setScreen('home')}
              onAccept={acceptJob}
              onStart={startJob}
              onComplete={completeJob}
              onReport={handleReport}
              onChat={handleChat}
              unread={unread[selectedJob.id] ?? 0}
            />
          )}
          {screen === 'chat' && selectedJob && user && (
            <ChatScreen job={selectedJob} user={user} onBack={() => setScreen('detail')} />
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
