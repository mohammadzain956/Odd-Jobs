import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@supabase/supabase-js';
import { remoteEnabled } from './config';
import { supabase } from './supabase';
import { AuthUser, ChatMessage, Job, JobDraft, SubmitResult } from './types';

const JOBS_KEY = 'odd_jobs_store.jobs';

export { remoteEnabled };

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function matchesFilters(job: Job, category: string, query: string): boolean {
  if (category !== 'All' && job.category !== category) {
    return false;
  }
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  return `${job.title} ${job.details} ${job.category} ${job.location}`.toLowerCase().includes(trimmed);
}

export async function loadJobs(): Promise<Job[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Could not load jobs:', error.message);
      return [];
    }
    return (data ?? []).map(rowToJob);
  }
  return loadLocalJobs();
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

export async function saveJobPatch(id: string, patch: Partial<Job>): Promise<void> {
  if (!supabase) {
    return;
  }
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.workerName !== undefined) row.worker_name = patch.workerName;
  if (patch.acceptedAt !== undefined) row.accepted_at = new Date(patch.acceptedAt).toISOString();
  if (patch.completedAt !== undefined) row.completed_at = new Date(patch.completedAt).toISOString();
  if (patch.status === 'ACCEPTED') {
    const { data } = await supabase.auth.getUser();
    row.accepted_by = data.user?.id ?? null;
  }
  const { error } = await supabase.from('jobs').update(row).eq('id', id);
  if (error) {
    console.warn('Could not update job:', error.message);
  }
}

export async function updateJobFields(id: string, draft: JobDraft): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase
    .from('jobs')
    .update({
      title: draft.title,
      details: draft.details,
      location: draft.location,
      pay: draft.pay,
      category: draft.category,
      urgency: draft.urgency,
      featured: draft.featured,
    })
    .eq('id', id);
  if (error) {
    console.warn('Could not update post:', error.message);
  }
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
  const senderName = String(userData.user.user_metadata?.display_name ?? '').trim() || 'User';
  const { data, error } = await supabase
    .from('messages')
    .insert({ job_id: jobId, sender_id: userData.user.id, sender_name: senderName, body })
    .select()
    .single();
  if (error) {
    console.warn('Could not send message:', error.message);
    return null;
  }
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

export async function reportJob(id: string, reason: string): Promise<void> {
  if (!supabase) {
    return;
  }
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('reports')
    .insert({ job_id: id, reason, created_by: data.user?.id ?? null });
  if (error) {
    console.warn('Could not save report:', error.message);
  }
}

async function uploadPhotos(localUris: string[]): Promise<string[]> {
  if (!supabase || localUris.length === 0) {
    return [];
  }
  const urls: string[] = [];
  for (const uri of localUris.slice(0, 5)) {
    try {
      const buffer = await fetch(uri).then((response) => response.arrayBuffer());
      const path = `${makeId()}.jpg`;
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
    distance: String(row.distance ?? 'Nearby'),
    createdAt: row.created_at ? Date.parse(String(row.created_at)) : 0,
    acceptedAt: row.accepted_at ? Date.parse(String(row.accepted_at)) : 0,
    completedAt: row.completed_at ? Date.parse(String(row.completed_at)) : 0,
    moderationStatus: row.moderation_status === 'pending' ? 'pending' : 'approved',
    createdBy: row.created_by ? String(row.created_by) : '',
    acceptedBy: row.accepted_by ? String(row.accepted_by) : '',
  };
}

function createLocalJob(draft: JobDraft): Job {
  return {
    ...draft,
    id: makeId(),
    status: 'OPEN',
    workerName: '',
    distance: 'Nearby',
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
  const samples: Array<[string, string, string, number, string, string, boolean, string]> = [
    [
      'Move sofa to second floor',
      'Need two careful helpers to move one sofa and a small table from the garage to an upstairs room.',
      'DHA Phase 5, Lahore',
      4500,
      'Moving',
      'Today',
      true,
      '2.1 km',
    ],
    [
      'Assemble wardrobe',
      'Flat-pack wardrobe is delivered. Bring a basic drill and help assemble it neatly.',
      'Gulberg, Lahore',
      3200,
      'Assembly',
      'This week',
      false,
      '3.4 km',
    ],
    [
      'Deep clean small office',
      'One-room office needs floor cleaning, dusting, and trash removal before Monday.',
      'Blue Area, Islamabad',
      6000,
      'Cleaning',
      'Flexible',
      true,
      'Nearby',
    ],
    [
      'Deliver documents',
      'Pick up a sealed envelope and deliver it across town. Delivery window is 2 pm to 5 pm.',
      'Clifton, Karachi',
      1800,
      'Delivery',
      'Today',
      false,
      '1.6 km',
    ],
  ];

  return samples.map(([title, details, location, pay, category, urgency, featured, distance]) => ({
    ...createLocalJob({ title, details, location, pay, category, urgency, featured, photos: [], requesterName: 'Verified customer' }),
    distance,
  }));
}
