import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AnimatedSplash from './src/AnimatedSplash';
import { Pill } from './src/components';
import AuthScreen from './src/screens/AuthScreen';
import ChatScreen from './src/screens/ChatScreen';
import DetailScreen from './src/screens/DetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import PostScreen from './src/screens/PostScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import UserScreen from './src/screens/UserScreen';
import WorkerScreen from './src/screens/WorkerScreen';
import {
  changeJobStatus,
  deleteJob,
  getSessionUser,
  loadFavorites,
  loadJobs,
  loadProfileStats,
  loadReviewedJobIds,
  loadUnreadCounts,
  markChatRead,
  persistLocal,
  remoteEnabled,
  removeCurrentPushToken,
  reportJob,
  savePushToken,
  setFavorite,
  signOutUser,
  submitJob,
  submitReview,
  subscribeToInbox,
  updateJobFields,
} from './src/store';
import { detectCity } from './src/location';
import { getPushToken, onNotificationTap } from './src/push';
import { colors, radius } from './src/theme';
import { AuthUser, Job, JobDraft, ProfileStats, Screen } from './src/types';

// Hold the native splash until the app has mounted, then the animated splash
// takes over and dismisses itself.
SplashScreen.preventAutoHideAsync().catch(() => {});

const SUBTITLES: Record<Screen, string> = {
  home: 'Local help, posted fast, picked up by nearby workers.',
  post: 'Post a clear request and get worker responses.',
  worker: 'Pick up nearby work and manage accepted jobs.',
  detail: 'Review the request before taking action.',
  profile: 'Your account and the posts you manage.',
  auth: 'Log in or create your account.',
  chat: 'Sort out the details together.',
  user: 'See who you are about to work with.',
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
  const [splashDone, setSplashDone] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [myStats, setMyStats] = useState<ProfileStats | null>(null);
  const [viewingUserId, setViewingUserId] = useState('');
  const [afterAuth, setAfterAuth] = useState<Screen>('home');
  const scrollRef = useRef<ScrollView>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeChatId = useRef('');

  useEffect(() => {
    Promise.all([loadJobs(), getSessionUser()]).then(([loaded, sessionUser]) => {
      setJobs(loaded);
      setUser(sessionUser);
      setReady(true);
    });
  }, []);

  // Saved jobs, reviews given, and the user's own reputation all belong to the
  // account, so they reload whenever the user changes (sign-out clears them).
  useEffect(() => {
    if (remoteEnabled && !user) {
      setSaved({});
      setReviewed({});
      setMyStats(null);
      return;
    }
    loadFavorites().then((ids) => {
      setSaved(Object.fromEntries(ids.map((id) => [id, true])));
    });
    if (user) {
      loadReviewedJobIds().then((ids) => {
        setReviewed(Object.fromEntries(ids.map((id) => [id, true])));
      });
      loadProfileStats(user.id).then(setMyStats);
    }
  }, [user?.id]);

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
    getPushToken().then((token) => {
      if (token) {
        void savePushToken(token);
      }
    });
    const offTap = onNotificationTap((data) => {
      const jobId = typeof data.jobId === 'string' ? data.jobId : '';
      if (jobId) {
        setUnread((current) => ({ ...current, [jobId]: 0 }));
        void markChatRead(jobId);
        setSelectedId(jobId);
        setScreen(data.kind === 'message' ? 'chat' : 'detail');
      }
    });
    loadUnreadCounts().then(setUnread);
    const unsubscribe = subscribeToInbox((message) => {
      if (message.senderId === user.id || activeChatId.current === message.jobId) {
        return;
      }
      setUnread((current) => ({ ...current, [message.jobId]: (current[message.jobId] ?? 0) + 1 }));
      notify(`New message from ${message.senderName}`);
    });
    return () => {
      offTap();
      unsubscribe();
    };
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
      setAfterAuth(destination);
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

  const patchLocal = (id: string, patch: Partial<Job>) => {
    updateJobs(jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  };

  // The server decides whether a status change is allowed; if it refuses, the
  // list is reloaded so the screen shows the real state rather than a guess.
  const applyStatus = async (
    id: string,
    action: 'accept' | 'start' | 'complete' | 'cancel',
    optimistic: Partial<Job>,
    successMessage: string,
  ) => {
    patchLocal(id, optimistic);
    const result = await changeJobStatus(id, action);
    if (!result.ok) {
      notify('That is no longer possible. Refreshing.');
      if (remoteEnabled) {
        loadJobs().then(setJobs);
      }
      return;
    }
    notify(successMessage);
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
      const result = await updateJobFields(editingId, draft);
      if (result.verdict === 'rejected') {
        notify(`Not saved: ${result.reason}`);
        return;
      }
      updateJobs(jobs.map((job) => (job.id === editingId ? result.job : job)));
      notify(result.verdict === 'pending' ? 'Edit submitted for review' : 'Post updated');
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
    void applyStatus(
      id,
      'accept',
      { status: 'ACCEPTED', workerName: user?.name ?? 'You', acceptedBy: user?.id ?? '', acceptedAt: Date.now() },
      'Job accepted',
    );
    openDetail(id);
  };

  const startJob = (id: string) => {
    void applyStatus(id, 'start', { status: 'IN_PROGRESS' }, 'Job marked in progress');
  };

  const completeJob = (id: string) => {
    void applyStatus(id, 'complete', { status: 'COMPLETED', completedAt: Date.now() }, 'Job completed');
  };

  // Releases a stuck job (worker vanished, or the worker can no longer do it)
  // back to the open feed. The server also clears the chat, since the match that
  // owned that conversation no longer exists.
  const cancelJob = (id: string) => {
    setUnread((current) => ({ ...current, [id]: 0 }));
    void applyStatus(
      id,
      'cancel',
      { status: 'OPEN', workerName: '', acceptedBy: '', acceptedAt: 0 },
      'Job re-opened for other workers',
    );
  };

  // Optimistic: the toggle flips immediately, and reverts if the server refuses.
  const handleToggleSave = (id: string) => {
    if (requireLogin(screen === 'detail' ? 'detail' : screen, 'Log in to save jobs')) {
      return;
    }
    const next = !saved[id];
    setSaved((current) => ({ ...current, [id]: next }));
    void setFavorite(id, next).then((ok) => {
      if (!ok) {
        setSaved((current) => ({ ...current, [id]: !next }));
        notify('Could not update your saved jobs.');
        return;
      }
      notify(next ? 'Saved to your list' : 'Removed from saved');
    });
  };

  const openUser = (userId: string) => {
    setViewingUserId(userId);
    setScreen('user');
  };

  const handleReview = (id: string, rating: number, comment: string) => {
    void submitReview(id, rating, comment).then((result) => {
      if (!result.ok) {
        notify(result.message ?? 'Could not submit your review.');
        return;
      }
      setReviewed((current) => ({ ...current, [id]: true }));
      notify('Review submitted');
      if (user) {
        loadProfileStats(user.id).then(setMyStats);
      }
    });
  };

  const handleReport = (id: string, reason: string) => {
    void reportJob(id, reason).then((result) => {
      notify(result.ok ? 'Thanks. Our team will review this post.' : (result.message ?? 'Could not send the report.'));
    });
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
    void removeCurrentPushToken().then(() => signOutUser());
    setUser(null);
    notify('Signed out');
  };

  const handleAuthDone = (signedIn: AuthUser) => {
    setUser(signedIn);
    setScreen(afterAuth);
    setAfterAuth('home');
    notify(`Welcome, ${signedIn.name}`);
  };

  const selectedJob = jobs.find((job) => job.id === selectedId);
  const editingJob = jobs.find((job) => job.id === editingId);

  // You may review a job you took part in, once it is done, and only once. The
  // server enforces all three; this just decides whether to show the form.
  const canReview = Boolean(
    user &&
      selectedJob &&
      selectedJob.status === 'COMPLETED' &&
      (selectedJob.createdBy === user.id || selectedJob.acceptedBy === user.id) &&
      selectedJob.createdBy !== '' &&
      selectedJob.acceptedBy !== '' &&
      !reviewed[selectedJob.id],
  );

  useEffect(() => {
    if (ready && (screen === 'detail' || screen === 'chat') && !selectedJob) {
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

          {screen !== 'detail' && screen !== 'chat' && screen !== 'user' && (
            <View style={styles.nav}>
              {NAV_ITEMS.map((item) => {
                const active = (screen === 'auth' ? afterAuth : screen) === item.screen;
                return (
                  <Pressable
                    key={item.screen}
                    onPress={() => openNav(item.screen)}
                    style={({ pressed }) => [styles.navButton, active && styles.navButtonActive, pressed && styles.navPressed]}
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
              onToggleSave={handleToggleSave}
              saved={saved}
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
              onToggleSave={handleToggleSave}
              saved={saved}
              unread={unread}
              stats={myStats}
            />
          )}
          {screen === 'profile' && (
            <ProfileScreen
              user={user}
              jobs={jobs}
              unread={unread}
              saved={saved}
              stats={myStats}
              onOpen={openDetail}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleSave={handleToggleSave}
              onOpenUser={openUser}
              onGoLogin={() => {
                setAfterAuth('profile');
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
              onCancel={cancelJob}
              onReport={handleReport}
              onChat={handleChat}
              onToggleSave={handleToggleSave}
              onOpenUser={openUser}
              onReview={handleReview}
              canReview={canReview}
              saved={saved[selectedJob.id] ?? false}
              unread={unread[selectedJob.id] ?? 0}
            />
          )}
          {screen === 'chat' && selectedJob && user && (
            <ChatScreen job={selectedJob} user={user} onBack={() => setScreen('detail')} />
          )}
          {screen === 'user' && viewingUserId !== '' && (
            <UserScreen userId={viewingUserId} onBack={() => setScreen(selectedId ? 'detail' : 'home')} />
          )}
        </ScrollView>

        {toast !== '' && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}

        {!splashDone && <AnimatedSplash onDone={() => setSplashDone(true)} />}
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
  navPressed: {
    opacity: 0.6,
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
