export type JobStatus = 'OPEN' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Job {
  id: string;
  title: string;
  details: string;
  location: string;
  pay: number;
  category: string;
  urgency: string;
  status: JobStatus;
  requesterName: string;
  workerName: string;
  featured: boolean;
  photos: string[];
  city: string;
  createdAt: number;
  acceptedAt: number;
  completedAt: number;
  moderationStatus: 'approved' | 'pending';
  createdBy: string;
  acceptedBy: string;
}

export interface ChatMessage {
  id: string;
  jobId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface Review {
  id: string;
  jobId: string;
  raterName: string;
  rating: number;
  comment: string;
  createdAt: number;
}

// The public reputation of a user: what a stranger is allowed to see before
// deciding to work with them. No email, no contact details.
export interface ProfileStats {
  name: string;
  jobsCompleted: number;
  jobsPosted: number;
  reviewCount: number;
  avgRating: number;
  memberSince: number;
}

export type SubmitResult =
  | { verdict: 'approved' | 'pending'; job: Job; reason?: string }
  | { verdict: 'rejected'; job: null; reason: string };

// Note: `featured` is deliberately NOT part of the draft. It is a paid placement,
// so only the server may set it - never the client. See supabase/functions/create-job.
export type JobDraft = Pick<
  Job,
  'title' | 'details' | 'location' | 'city' | 'pay' | 'category' | 'urgency' | 'photos' | 'requesterName'
>;

export type Screen = 'home' | 'post' | 'worker' | 'detail' | 'profile' | 'auth' | 'chat' | 'user';

export const CATEGORIES = [
  'Moving',
  'Cleaning',
  'Repairs',
  'Yard work',
  'Delivery',
  'Assembly',
  'Tutoring',
  'General help',
] as const;

export const CATEGORY_FILTERS = ['All', ...CATEGORIES] as const;

export const URGENCIES = ['Today', 'This week', 'Flexible'] as const;
