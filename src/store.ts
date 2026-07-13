import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { remoteEnabled } from './config';
import { supabase } from './supabase';
import { AuthUser, ChatMessage, Job, JobDraft, ProfileStats, Review, SubmitResult } from './types';

const JOBS_KEY = 'odd_jobs_store.jobs';
const FAVORITES_KEY = 'odd_jobs_store.favorites';

export { remoteEnabled };

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function matchesFilters(job: Job, category: string, query: string, city: string, area: string): boolean {
  if (city !== 'All' && job.city !== city) {
    return false;
  }
  if (area !== 'All' && job.location !== area) {
    return false;
  }
  if (category !== 'All' && job.category !== category) {
    return false;
  }
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  return `${job.title} ${job.details} ${job.category} ${job.location} ${job.city}`.toLowerCase().includes(trimmed);
}

// Loads the newest slice of the public feed plus everything the signed-in user
// is involved in, so their own posts and accepted jobs are always present even
// once the feed grows past the page limit.
export async function loadJobs(): Promise<Job[]> {
  if (!supabase) {
    return loadLocalJobs();
  }
  const feedQuery = supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const mineQuery = userId
    ? supabase
        .from('jobs')
        .select('*')
        .or(`created_by.eq.${userId},accepted_by.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(200)
    : null;

  const [feed, mine] = await Promise.all([feedQuery, mineQuery]);
  if (feed.error) {
    console.warn('Could not load jobs:', feed.error.message);
    return [];
  }

  const byId = new Map<string, Job>();
  for (const row of [...(feed.data ?? []), ...(mine?.data ?? [])]) {
    const job = rowToJob(row);
    byId.set(job.id, job);
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function submitJob(draft: JobDraft): Promise<SubmitResult> {
  if (supabase) {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      return { verdict: 'rejected', job: null, reason: 'Please log in to post a job.' };
    }
    const photos = await uploadPhotos(draft.photos);
    const { data, error } = await supabase.functions.invoke('create-job', { body: { ...draft, photos } });
    if (error || !data) {
      return { verdict: 'rejected', job: null, reason: 'Could not reach the server. Try again.' };
    }
    if (data.verdict === 'rejected') {
      return { verdict: 'rejected', job: null, reason: data.reason };
    }
    return { verdict: data.verdict, job: rowToJob(data.job), reason: data.reason };
  }
  return { verdict: 'approved', job: createLocalJob(draft) };
}

// Status changes go through database functions that enforce who may make each
// transition; clients have no direct update rights on jobs.
export async function changeJobStatus(
  id: string,
  action: 'accept' | 'start' | 'complete' | 'cancel',
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) {
    return { ok: true };
  }
  const RPCS = {
    accept: 'accept_job',
    start: 'start_job',
    complete: 'complete_job',
    cancel: 'cancel_job',
  } as const;
  const { error } = await supabase.rpc(RPCS[action], { p_job_id: id });
  if (error) {
    return { ok: false, message: error.message };
  }
  if (action === 'accept') {
    void supabase.functions.invoke('push', { body: { jobId: id, kind: 'accepted' } });
  }
  return { ok: true };
}

// Edits run through the same moderated path as new posts.
export async function updateJobFields(id: string, draft: JobDraft): Promise<SubmitResult> {
  if (!supabase) {
    return { verdict: 'approved', job: { ...createLocalJob(draft), id } };
  }
  const { data, error } = await supabase.functions.invoke('create-job', {
    body: { ...draft, jobId: id, photos: [] },
  });
  if (error || !data) {
    return { verdict: 'rejected', job: null, reason: 'Could not reach the server. Try again.' };
  }
  if (data.verdict === 'rejected') {
    return { verdict: 'rejected', job: null, reason: data.reason };
  }
  return { verdict: data.verdict, job: rowToJob(data.job), reason: data.reason };
}

export async function deleteJob(id: string): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) {
    console.warn('Could not delete post:', error.message);
  }
}

let currentPushToken: string | null = null;

export async function savePushToken(token: string): Promise<void> {
  if (!supabase) {
    return;
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return;
  }
  currentPushToken = token;
  const { error } = await supabase.from('push_tokens').upsert({ token, user_id: data.user.id });
  if (error) {
    console.warn('Could not save push token:', error.message);
  }
}

export async function removeCurrentPushToken(): Promise<void> {
  if (!supabase || !currentPushToken) {
    return;
  }
  await supabase.from('push_tokens').delete().eq('token', currentPushToken);
  currentPushToken = null;
}

function toAuthUser(user: User): AuthUser {
  const name = String(user.user_metadata?.display_name ?? '').trim();
  return { id: user.id, email: user.email ?? '', name: name || (user.email ?? 'User') };
}

export async function getSessionUser(): Promise<AuthUser | null> {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session ? toAuthUser(data.session.user) : null;
}

export async function signUpUser(
  name: string,
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; message?: string }> {
  if (!supabase) {
    return { user: null, message: 'Backend is not connected yet.' };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) {
    return { user: null, message: error.message };
  }
  if (!data.session) {
    return { user: null, message: 'Check your email to confirm your account, then log in.' };
  }
  return { user: toAuthUser(data.session.user) };
}

export async function signInUser(
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; message?: string }> {
  if (!supabase) {
    return { user: null, message: 'Backend is not connected yet.' };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { user: null, message: error.message };
  }
  return { user: toAuthUser(data.user) };
}

export async function signOutUser(): Promise<void> {
  await supabase?.auth.signOut();
}

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    senderId: String(row.sender_id),
    senderName: String(row.sender_name ?? ''),
    body: String(row.body ?? ''),
    createdAt: row.created_at ? Date.parse(String(row.created_at)) : 0,
  };
}

export async function loadMessages(jobId: string): Promise<ChatMessage[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('Could not load messages:', error.message);
    return [];
  }
  return (data ?? []).map(rowToMessage);
}

export async function sendMessage(jobId: string, body: string): Promise<ChatMessage | null> {
  if (!supabase) {
    return null;
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return null;
  }
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) {
    return null;
  }
  const senderName = String(userData.user.user_metadata?.display_name ?? '').trim() || 'User';
  const { data, error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, sender_id: userData.user.id, sender_name: senderName, body: trimmed })
    .select()
    .single();
  if (error) {
    console.warn('Could not send message:', error.message);
    return null;
  }
  void supabase.functions.invoke('push', { body: { jobId, kind: 'message', preview: trimmed } });
  return rowToMessage(data);
}

export function subscribeToMessages(jobId: string, onNew: (message: ChatMessage) => void): () => void {
  if (!supabase) {
    return () => {};
  }
  const channel = supabase
    .channel(`messages-${jobId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
      (payload) => onNew(rowToMessage(payload.new as Record<string, unknown>)),
    )
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}

// Listens to every chat the signed-in user participates in (row security
// filters out everyone else's chats server-side).
export function subscribeToInbox(onNew: (message: ChatMessage) => void): () => void {
  if (!supabase) {
    return () => {};
  }
  const channel = supabase
    .channel('messages-inbox')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => onNew(rowToMessage(payload.new as Record<string, unknown>)),
    )
    .subscribe();
  return () => {
    void supabase?.removeChannel(channel);
  };
}

export async function markChatRead(jobId: string): Promise<void> {
  if (!supabase) {
    return;
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return;
  }
  const { error } = await supabase
    .from('chat_reads')
    .upsert({ job_id: jobId, user_id: data.user.id, last_read_at: new Date().toISOString() });
  if (error) {
    console.warn('Could not mark chat read:', error.message);
  }
}

export async function loadUnreadCounts(): Promise<Record<string, number>> {
  if (!supabase) {
    return {};
  }
  const { data, error } = await supabase.rpc('unread_counts');
  if (error || !data) {
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data as Array<{ job_id: string; unread: number }>) {
    counts[row.job_id] = Number(row.unread);
  }
  return counts;
}

// Reviews. The client never says who is being rated - submit_review derives that
// from the job, so a review cannot be forged against someone you never worked with.
export async function submitReview(
  jobId: string,
  rating: number,
  comment: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) {
    return { ok: false, message: 'Reviews need the online backend.' };
  }
  const { error } = await supabase.rpc('submit_review', {
    p_job_id: jobId,
    p_rating: rating,
    p_comment: comment,
  });
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

// Job ids the signed-in user has already reviewed, so the app does not offer to
// rate the same job twice.
export async function loadReviewedJobIds(): Promise<string[]> {
  if (!supabase) {
    return [];
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return [];
  }
  const { data, error } = await supabase.from('reviews').select('job_id').eq('rater_id', userData.user.id);
  if (error) {
    return [];
  }
  return (data ?? []).map((row) => String(row.job_id));
}

export async function loadReviews(userId: string): Promise<Review[]> {
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('ratee_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    console.warn('Could not load reviews:', error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    jobId: String(row.job_id),
    raterName: String(row.rater_name ?? 'User'),
    rating: Number(row.rating ?? 0),
    comment: String(row.comment ?? ''),
    createdAt: row.created_at ? Date.parse(String(row.created_at)) : 0,
  }));
}

export async function loadProfileStats(userId: string): Promise<ProfileStats | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc('profile_stats', { p_user_id: userId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return null;
  }
  return {
    name: String(row.name ?? 'User'),
    jobsCompleted: Number(row.jobs_completed ?? 0),
    jobsPosted: Number(row.jobs_posted ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    avgRating: Number(row.avg_rating ?? 0),
    memberSince: row.member_since ? Date.parse(String(row.member_since)) : 0,
  };
}

// Saved jobs. A save is private to the user who made it: the table's policies
// only ever expose your own rows, so no one can see what anyone else saved.
export async function loadFavorites(): Promise<string[]> {
  if (!supabase) {
    return loadLocalFavorites();
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return [];
  }
  const { data, error } = await supabase.from('favorites').select('job_id');
  if (error) {
    console.warn('Could not load saved jobs:', error.message);
    return [];
  }
  return (data ?? []).map((row) => String(row.job_id));
}

export async function setFavorite(jobId: string, saved: boolean): Promise<boolean> {
  if (!supabase) {
    const current = await loadLocalFavorites();
    const next = saved ? [...new Set([...current, jobId])] : current.filter((id) => id !== jobId);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    return true;
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return false;
  }
  const { error } = saved
    ? await supabase.from('favorites').upsert({ user_id: userData.user.id, job_id: jobId })
    : await supabase.from('favorites').delete().eq('user_id', userData.user.id).eq('job_id', jobId);
  if (error) {
    console.warn('Could not update saved job:', error.message);
    return false;
  }
  return true;
}

async function loadLocalFavorites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function reportJob(id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
  if (!supabase) {
    return { ok: true };
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { ok: false, message: 'Log in to report a post.' };
  }
  const { error } = await supabase
    .from('reports')
    .insert({ job_id: id, reason, created_by: data.user.id });
  if (error) {
    // A duplicate key means this user already reported this post.
    return {
      ok: false,
      message: error.code === '23505' ? 'You already reported this post.' : 'Could not send the report.',
    };
  }
  return { ok: true };
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

async function uploadPhotos(localUris: string[]): Promise<string[]> {
  if (!supabase || localUris.length === 0) {
    return [];
  }
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    return [];
  }
  const urls: string[] = [];
  for (const uri of localUris.slice(0, 5)) {
    try {
      const buffer = await fetch(uri).then((response) => response.arrayBuffer());
      if (buffer.byteLength > MAX_PHOTO_BYTES) {
        continue;
      }
      // Photos live under the uploader's own folder; storage rules reject writes
      // anywhere else, so nobody can overwrite another user's photos.
      const path = `${userId}/${makeId()}.jpg`;
      const { error } = await supabase.storage
        .from('job-photos')
        .upload(path, buffer, { contentType: 'image/jpeg' });
      if (!error) {
        urls.push(supabase.storage.from('job-photos').getPublicUrl(path).data.publicUrl);
      }
    } catch {
      // Skip photos that fail to upload; the post itself still goes through.
    }
  }
  return urls;
}

export async function persistLocal(jobs: Job[]): Promise<void> {
  try {
    await AsyncStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  } catch {
    // Storage full or unavailable: the in-memory list still works for this session.
  }
}

function rowToJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    details: String(row.details ?? ''),
    location: String(row.location ?? ''),
    pay: Number(row.pay ?? 0),
    category: String(row.category ?? 'General help'),
    urgency: String(row.urgency ?? 'Flexible'),
    status: (row.status as Job['status']) ?? 'OPEN',
    requesterName: String(row.requester_name ?? 'Customer'),
    workerName: String(row.worker_name ?? ''),
    featured: Boolean(row.featured),
    photos: Array.isArray(row.photos) ? row.photos.map(String) : [],
    city: String(row.city ?? ''),
    createdAt: row.created_at ? Date.parse(String(row.created_at)) : 0,
    acceptedAt: row.accepted_at ? Date.parse(String(row.accepted_at)) : 0,
    completedAt: row.completed_at ? Date.parse(String(row.completed_at)) : 0,
    moderationStatus: row.moderation_status === 'pending' ? 'pending' : 'approved',
    createdBy: row.created_by ? String(row.created_by) : '',
    acceptedBy: row.accepted_by ? String(row.accepted_by) : '',
  };
}

function createLocalJob(draft: JobDraft, featured = false): Job {
  return {
    ...draft,
    id: makeId(),
    featured,
    status: 'OPEN',
    workerName: '',
    createdAt: Date.now(),
    acceptedAt: 0,
    completedAt: 0,
    moderationStatus: 'approved',
    createdBy: '',
    acceptedBy: '',
  };
}

async function loadLocalJobs(): Promise<Job[]> {
  try {
    const raw = await AsyncStorage.getItem(JOBS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as Job[];
      }
    }
  } catch {
    // Corrupt or unreadable store: fall through to a fresh seed.
  }
  const seeded = seedJobs();
  void persistLocal(seeded);
  return seeded;
}

function seedJobs(): Job[] {
  const samples: Array<[string, string, string, string, number, string, string, boolean]> = [
    [
      'Move sofa to second floor',
      'Need two careful helpers to move one sofa and a small table from the garage to an upstairs room.',
      'DHA',
      'Lahore',
      4500,
      'Moving',
      'Today',
      true,
    ],
    [
      'Assemble wardrobe',
      'Flat-pack wardrobe is delivered. Bring a basic drill and help assemble it neatly.',
      'Gulberg',
      'Lahore',
      3200,
      'Assembly',
      'This week',
      false,
    ],
    [
      'Deep clean small office',
      'One-room office needs floor cleaning, dusting, and trash removal before Monday.',
      'Blue Area',
      'Islamabad',
      6000,
      'Cleaning',
      'Flexible',
      true,
    ],
    [
      'Deliver documents',
      'Pick up a sealed envelope and deliver it across town. Delivery window is 2 pm to 5 pm.',
      'Clifton',
      'Karachi',
      1800,
      'Delivery',
      'Today',
      false,
    ],
  ];

  return samples.map(([title, details, location, city, pay, category, urgency, featured]) =>
    createLocalJob(
      { title, details, location, city, pay, category, urgency, photos: [], requesterName: 'Verified customer' },
      featured,
    ),
  );
}
