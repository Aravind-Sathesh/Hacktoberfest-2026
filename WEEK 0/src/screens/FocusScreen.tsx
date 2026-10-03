import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import { type Problem, isSolved, problemId, userStatus } from '../cf';
import { EditorialLoader } from '../EditorialLoader';
import { canRunGemma, hints, isModelDownloaded, roast } from '../gemma';
import { HintStack } from '../HintStack';
import type { RoastEvent } from '../prompts';
import { addSession } from '../sessions';
import { colors } from '../theme';
import { FULL_GROWTH_MINUTES, Tree } from '../Tree';
import { Button, Dialog, Mono } from '../ui';

type Props = {
  problem: Problem;
  handle: string;
  accent: string;
  onDone: () => void;
  onGrown: () => void;
};

type Outcome = 'growing' | 'grown' | 'dead';

// A glance at a message is fine; longer than this away and the tree dies.
const GRACE_MS = 10_000;
const POLL_MS = 60_000;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function FocusScreen({ problem, handle, accent, onDone, onGrown }: Props) {
  // He solves on his pc; the phone sits awake beside him. Sleep would count as leaving.
  useKeepAwake();

  const { width } = useWindowDimensions();
  const id = problemId(problem);
  const [startedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  const [outcome, setOutcome] = useState<Outcome>('growing');
  // What gemma has to say about the session: a roast, or news from codeforces.
  const [line, setLine] = useState<string | null>(null);
  const [confirmingGiveUp, setConfirmingGiveUp] = useState(false);
  const [checking, setChecking] = useState(false);
  // undefined while the hidden browser is still looking; null when there is no usable editorial.
  const [editorial, setEditorial] = useState<string | null | undefined>(
    undefined,
  );
  const gemmaReady = canRunGemma() && isModelDownloaded();
  // undefined while gemma writes them in the background.
  const [hintList, setHintList] = useState<string[] | undefined>(undefined);

  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;

  const elapsedMinutes = () => Math.floor((Date.now() - startedAt) / 60_000);

  function finish(result: 'grown' | 'dead', solvedId = id) {
    if (outcomeRef.current !== 'growing') return;
    outcomeRef.current = result;
    setOutcome(result);
    if (result === 'grown') onGrown();
    addSession({
      problemId: solvedId,
      outcome: result,
      minutes: elapsedMinutes(),
      at: Date.now(),
    });
  }

  async function die(kind: RoastEvent['kind']) {
    if (outcomeRef.current !== 'growing') return;
    finish('dead');
    setLine(await roast({ kind, minutes: elapsedMinutes(), problemName: problem.name }));
  }

  const confirmGiveUp = () => setConfirmingGiveUp(true);

  /**
   * Grows the tree on any accepted submission since the timer started: the tree is for staying
   * focused, and solving a different problem than planned still counts.
   */
  async function checkAccepted(): Promise<boolean> {
    const recent = await userStatus(handle, 5);
    const accepted = recent.find((s) => isSolved(s) && s.creationTimeSeconds * 1000 >= startedAt);
    if (accepted && outcomeRef.current === 'growing') {
      const solvedId = problemId(accepted.problem);
      finish('grown', solvedId);
      setLine(
        solvedId === id
          ? 'accepted. the tree stays. go get the next one.'
          : `accepted ${solvedId}. not the one you picked, but the tree stays.`,
      );
    }
    return accepted !== undefined;
  }

  async function checkNow() {
    setChecking(true);
    try {
      if (!(await checkAccepted())) {
        setLine('no accepted submission yet. keep going.');
      }
    } catch {
      setLine("couldn't reach codeforces. try again in a bit.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (!editorial) return;
    let live = true;
    hints(problem, editorial).then((h) => live && setHintList(h));
    return () => {
      live = false;
    };
  }, [editorial]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let leftAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt = Date.now();
      if (state === 'active' && leftAt !== null) {
        if (Date.now() - leftAt > GRACE_MS) die('left');
        leftAt = null;
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      if (outcomeRef.current !== 'growing') return;
      try {
        await checkAccepted();
      } catch {
        // A missed poll just means we check again next minute.
      }
    }, POLL_MS);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    // Back is not an exit while the tree is growing; giving up is.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (outcomeRef.current === 'growing') confirmGiveUp();
      else onDone();
      return true;
    });
    return () => sub.remove();
  }, [onDone]);

  const growing = outcome === 'growing';
  const growth =
    outcome === 'grown' ? 1 : (now - startedAt) / 60_000 / FULL_GROWTH_MINUTES;

  return (
    <View style={styles.container}>
      {gemmaReady && editorial === undefined && (
        <EditorialLoader problem={problem} onLoaded={setEditorial} />
      )}
      <View style={styles.topBar}>
        {growing ? (
          <Button
            label='give up'
            icon='x'
            iconOnly
            onPress={confirmGiveUp}
            accent={accent}
            variant='outline'
          />
        ) : (
          <Button
            label='back to today'
            icon='arrow-left'
            iconOnly
            onPress={onDone}
            accent={accent}
            variant='outline'
          />
        )}
        <View style={styles.title}>
          <Mono bold numberOfLines={1}>
            {problem.name}
          </Mono>
          <Mono color={colors.muted} size={12}>
            {id} · {problem.rating ?? 'unrated'}
          </Mono>
        </View>
        {growing && (
          <Button
            label='check for an accepted submission'
            icon='refresh-cw'
            iconOnly
            onPress={checkNow}
            accent={accent}
            variant='outline'
            disabled={checking}
          />
        )}
      </View>

      <View style={styles.treeArea}>
        <Tree
          growth={growth}
          dead={outcome === 'dead'}
          size={Math.min(width - 40, 340)}
        />
        <Mono
          bold
          size={34}
          color={outcome === 'dead' ? colors.danger : accent}
        >
          {growing
            ? clock(now - startedAt)
            : outcome === 'grown'
              ? 'solved'
              : 'tree lost'}
        </Mono>
      </View>

      {line && (
        <Mono color={colors.muted} style={styles.line}>
          {line}
        </Mono>
      )}

      {!gemmaReady ? (
        <Mono color={colors.muted}>hints need gemma. download it from today.</Mono>
      ) : editorial === null ? (
        <Mono color={colors.muted}>no editorial for this one, so no hints. you've got this.</Mono>
      ) : hintList === undefined ? (
        <Mono color={colors.muted}>gemma is reading the editorial…</Mono>
      ) : hintList.length === 0 ? (
        <Mono color={colors.muted}>gemma couldn't write hints for this one.</Mono>
      ) : (
        <HintStack hints={hintList} accent={accent} />
      )}

      {!growing && (
        <Button
          label='back to today'
          icon='arrow-left'
          onPress={onDone}
          accent={accent}
        />
      )}

      <Dialog
        visible={confirmingGiveUp}
        title='give up?'
        message='are you sure you want to kill that tree?'
        confirmLabel='give up'
        cancelLabel='keep going'
        onCancel={() => setConfirmingGiveUp(false)}
        onConfirm={() => {
          setConfirmingGiveUp(false);
          die('gave-up');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, paddingBottom: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1 },
  treeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  line: { textAlign: 'center' },
});
