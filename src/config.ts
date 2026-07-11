// Paste your Supabase project credentials here (Dashboard > Project Settings > API).
// While these are empty, the app runs in offline mode and stores jobs on the device.
export const SUPABASE_URL = 'https://mjfaswtmnehnljoycghu.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_BAaRSVdxKI-eWBaY-sqJ2g_QmLZibtA';

export const remoteEnabled = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
