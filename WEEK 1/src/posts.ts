import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { fromRow, toRow, type PostRow } from './community';
import type { Trek } from './treks';

// Community is the only part of TrailKit that talks to a server. Everything else stays on the phone.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

// The anonymous session lives in a file, like the rest of our data; no AsyncStorage dependency
const sessionFile = (key: string) => new File(Paths.document, `auth-${key.replace(/\W/g, '_')}.json`);
const fileStorage = {
  getItem: async (key: string) => {
    const f = sessionFile(key);
    return f.exists ? f.text() : null;
  },
  setItem: async (key: string, value: string) => sessionFile(key).write(value),
  removeItem: async (key: string) => {
    const f = sessionFile(key);
    if (f.exists) f.delete();
  },
};

const client: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storage: fileStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

// Plain-language messages; Supabase's own errors are logged, not shown
const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match.',
  user_already_exists: 'There’s already an account with that email. Sign in instead.',
  email_exists: 'There’s already an account with that email. Sign in instead.',
  weak_password: 'Choose a longer password (at least 8 characters).',
  same_password: 'Choose a password you haven’t used before.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes and try again.',
  email_not_confirmed: 'Confirm your email first: open the link we sent you, then sign in.',
};

function authError(error: { code?: string; message: string }, fallback: string): Error {
  console.warn('[auth]', error.code, error.message);
  return new Error(AUTH_ERRORS[error.code ?? ''] ?? fallback);
}

function need(): SupabaseClient {
  if (!client) throw new Error('Accounts aren’t set up in this build.');
  return client;
}

/** The signed-in account's email, or null. Works offline from the saved session. */
export async function currentEmail(): Promise<string | null> {
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    // Anonymous sessions from older builds have an empty email: treat them as signed out
    return data.session?.user.email || null;
  } catch (err) {
    console.warn('[auth] could not read the saved session:', err);
    return null;
  }
}

/** 'signed-in', or 'confirm-email' when the project requires the user to click a link first. */
export async function signUp(email: string, password: string): Promise<'signed-in' | 'confirm-email'> {
  const { data, error } = await need().auth.signUp({ email, password });
  if (error) throw authError(error, 'Couldn’t create your account. Check your connection.');
  return data.session ? 'signed-in' : 'confirm-email';
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await need().auth.signInWithPassword({ email, password });
  if (error) throw authError(error, 'Couldn’t sign in. Check your connection.');
}

// Supabase's default emails (no custom SMTP) can only carry a link, so the link opens the app.
// This URL must be in Authentication → URL Configuration → Redirect URLs.
export const RESET_REDIRECT = 'trailkit://reset-password';

/** Emails a reset link that opens TrailKit. */
export async function sendResetLink(email: string): Promise<void> {
  const { error } = await need().auth.resetPasswordForEmail(email, { redirectTo: RESET_REDIRECT });
  if (error) throw authError(error, 'Couldn’t send the email. Check your connection.');
}

/**
 * Handles a reset link opened in the app: signs in from the tokens in the link so a new password
 * can be set. Returns false for any other URL, or a link that's expired.
 */
export async function openRecoveryLink(url: string): Promise<boolean> {
  if (!client || !url.startsWith(RESET_REDIRECT)) return false;
  // Tokens arrive after '#' (or '?' from some mail apps)
  const params = new URLSearchParams(url.split(/[#?]/).slice(1).join('&'));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (params.get('error') || !access_token || !refresh_token) return false;
  const { error } = await client.auth.setSession({ access_token, refresh_token });
  if (error) {
    console.warn('[auth] recovery link failed:', error.message);
    return false;
  }
  return true;
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await need().auth.updateUser({ password });
  if (error) throw authError(error, 'Couldn’t save the new password. Check your connection.');
}

/** Signs out on this phone; treks and profile stay. */
export async function signOut(): Promise<void> {
  await need().auth.signOut({ scope: 'local' });
}

/** Each account can only write its own rows; there's no posting without one. */
async function userId(): Promise<string> {
  const { data } = await need().auth.getSession();
  if (!data.session) throw new Error('Sign in to use Community.');
  return data.session.user.id;
}

/**
 * Shrinks a photo to a 256 px square JPEG and uploads it as the account's profile photo.
 * Returns its public URL, versioned so a changed photo isn't served from cache.
 */
export async function uploadAvatar(localUri: string): Promise<string> {
  const c = need();
  const me = await userId();
  const small = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 256, height: 256 } }], {
    format: ImageManipulator.SaveFormat.JPEG,
    compress: 0.8,
  });
  const bytes = await new File(small.uri).bytes();
  const { error } = await c.storage.from('avatars').upload(`${me}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    console.warn('[auth] avatar upload failed:', error.message);
    throw new Error('Couldn’t upload your photo. It’s saved on this phone and will upload next time.');
  }
  return `${c.storage.from('avatars').getPublicUrl(`${me}.jpg`).data.publicUrl}?v=${Date.now()}`;
}

/** Latest posts from other hikers (yours come from the phone). */
export async function fetchPosts(): Promise<Trek[]> {
  if (!client) return [];
  const me = await userId();
  const { data, error } = await client
    .from('posts')
    .select('*')
    .neq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error('Couldn’t load Community. Check your connection.');
  return (data as PostRow[]).map(fromRow);
}

/** Posts (or re-posts) your treks; safe to repeat, since a trek is one row per phone. */
export async function publish(treks: readonly Trek[], author: string, avatarUrl: string | null): Promise<void> {
  if (!client || treks.length === 0) return;
  const me = await userId();
  const rows = treks.map((t) => ({ ...toRow(t, author), avatar_url: avatarUrl, user_id: me }));
  const { error } = await client.from('posts').upsert(rows, { onConflict: 'user_id,local_id' });
  if (error) throw new Error('Couldn’t post. It will try again next time you’re online.');
}

export async function unpublish(trek: Trek): Promise<void> {
  if (!client) return;
  const me = await userId();
  const { error } = await client.from('posts').delete().eq('user_id', me).eq('local_id', trek.id);
  if (error) throw new Error('Couldn’t make it private. Check your connection.');
}

/**
 * Deletes this phone's Community account and, through the cascade, everything it posted.
 * A phone that never posted has no account, so there's nothing to delete on the server.
 */
export async function deleteAccount(): Promise<void> {
  if (!client) return;
  const { data } = await client.auth.getSession();
  if (!data.session) return;
  // Storage rows can't be removed by the database function, so take the photo down first
  await client.storage.from('avatars').remove([`${data.session.user.id}.jpg`]);
  const { error } = await client.rpc('delete_me');
  if (error) throw new Error('Couldn’t delete your Community posts. Connect to the internet and try again.');
  await client.auth.signOut({ scope: 'local' });
}

export const communityReady = client !== null;
