import AsyncStorage from '@react-native-async-storage/async-storage';

export type Session = {
  problemId: string;
  outcome: 'grown' | 'dead';
  minutes: number;
  /** epoch ms */
  at: number;
};

export type Forest = { grown: number; dead: number };

const KEY = 'sessions';

export async function loadSessions(): Promise<Session[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Session[]) : [];
}

export async function addSession(session: Session): Promise<void> {
  const sessions = await loadSessions();
  await AsyncStorage.setItem(KEY, JSON.stringify([...sessions, session]));
}

export const forest = (sessions: Session[]): Forest => ({
  grown: sessions.filter((s) => s.outcome === 'grown').length,
  dead: sessions.filter((s) => s.outcome === 'dead').length,
});
