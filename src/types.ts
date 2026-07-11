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
  distance: string;
  createdAt: number;
  acceptedAt: number;
  completedAt: number;
  moderationStatus: 'approved' | 'pending';
}

export type SubmitResult =
  | { verdict: 'approved' | 'pending'; job: Job; reason?: string }
  | { verdict: 'rejected'; job: null; reason: string };

export type JobDraft = Pick<
  Job,
  'title' | 'details' | 'location' | 'pay' | 'category' | 'urgency' | 'featured' | 'photos' | 'requesterName'
>;

export type Screen = 'home' | 'post' | 'worker' | 'detail';

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
