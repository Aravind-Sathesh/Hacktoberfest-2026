import { Inter_400Regular, Inter_400Regular_Italic, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, ScrollView, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { classifyWithBioClip, isBioClipModelDownloaded } from './src/bioclip';
import { buildGemmaPrompt, cardJsonSchema, parseGemmaCard, type GemmaCard } from './src/card';
import { completeJson, getGemmaThreadCount, isGemmaDownloaded, setGemmaThreadCount } from './src/gemma';
import { DEFAULT_COSINE_FLOOR, evaluateSafety } from './src/safety';
import { CommunityScreen } from './src/screens/CommunityScreen';
import { ExploreScreen } from './src/screens/ExploreScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { PreflightScreen } from './src/screens/PreflightScreen';
import { ProfileScreen, type CalibrationItem, type Sample } from './src/screens/ProfileScreen';
import { IdentifyScreen, type IdResult } from './src/screens/IdentifyScreen';
import { SummaryScreen } from './src/screens/SummaryScreen';
import { TrekScreen } from './src/screens/TrekScreen';
import { DEFAULT_FILTERS, type PostFilters } from './src/community';
import {
  communityReady,
  currentEmail,
  deleteAccount,
  fetchPosts,
  openRecoveryLink,
  publish,
  signOut,
  unpublish,
  uploadAvatar,
} from './src/posts';
import { AccountStep } from './src/screens/AccountStep';
import { COMMUNITY_POSTS } from './src/samples';
import { keepPhoto, loadState, saveState, wipeLocalData } from './src/store';
import { simplify, trackStats } from './src/track';
import { currentFix, startTracking, stopTracking } from './src/tracking';
import { applyAccent, applyTheme, useTheme } from './src/theme';
import { applyUnits } from './src/units';
import { EMPTY_STATE, addSighting, endTrek, setShared, startTrek, type AppState, type GearItem, type Profile, type Trek } from './src/treks';
import { PillNav, PushTransition, TabTransition, type TabId } from './src/ui';
import { FIELD_SAMPLE_BASE64 } from './test/fixtures/fieldSampleBase64';

// Only the Calotropis photo is bundled; the others are pushed with adb (see SPIKE.md)
const SAMPLES: readonly Sample[] = [
  { file: 'field_sample.jpg', name: 'Crown Flower' },
  { file: 'cobra.jpg', name: 'Cobra' },
  { file: 'plain_tiger.jpg', name: 'Plain Tiger' },
  { file: 'robin.jpg', name: 'Robin (not listed)' },
  { file: 'coffee_mug.jpg', name: 'Mug (not alive)' },
];


type View_ = 'explore' | 'plan' | 'trek' | 'summary';

// Enough to draw a smooth outline on a card without storing every fix
const ROUTE_POINTS = 300;

// The dark splash stays up until fonts, saved data and the session are read, so there's no blank flash
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  return (
    <SafeAreaProvider>
      <TrailKit />
    </SafeAreaProvider>
  );
}

function TrailKit() {
  // Real insets: the iPhone's Dynamic Island is ~59 pt, Android's status bar ~24 dp
  const TOP_INSET = useSafeAreaInsets().top;
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_400Regular_Italic, Inter_600SemiBold });
  const { colors, isDark } = useTheme();

  // Navigation
  const [tab, setTab] = useState<TabId>('start');
  const [view, setView] = useState<View_>('explore');
  const [openTrekId, setOpenTrekId] = useState<string | null>(null);
  const [pushDirection, setPushDirection] = useState<'forward' | 'backward'>('forward');
  const [editingProfile, setEditingProfile] = useState(false);
  const [planTemplate, setPlanTemplate] = useState<Trek | null>(null);
  const [preflight, setPreflight] = useState<Trek | null>(null);
  const [openPost, setOpenPost] = useState<Trek | null>(null);
  const [postFilters, setPostFilters] = useState<PostFilters>(DEFAULT_FILTERS);
  const [remotePosts, setRemotePosts] = useState<Trek[]>([]);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // null until the saved session is read; accounts are skipped entirely in builds without Supabase
  const [email, setEmail] = useState<string | null | undefined>(communityReady ? undefined : null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Saved data
  const [state, setState] = useState<AppState>(EMPTY_STATE);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Field ID, shown over whichever screen started it
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IdResult | null>(null);

  // Models and developer tools
  const [offlineReady, setOfflineReady] = useState(false);
  const [threadCount, setThreadCount] = useState(getGemmaThreadCount());
  const [calibration, setCalibration] = useState<readonly CalibrationItem[]>([]);
  const [calibrating, setCalibrating] = useState(false);

  const activeTrek = state.treks.find((t) => t.status === 'active') ?? null;
  const allTreks = useMemo(() => [...state.treks, ...COMMUNITY_POSTS], [state.treks]);
  // Your posts first, then everyone else's; nothing of yours appears here until you post it
  const myPosts = useMemo(() => state.treks.filter((t) => t.shared && t.status === 'done').reverse(), [state.treks]);
  const posts = useMemo(() => [...myPosts, ...remotePosts, ...COMMUNITY_POSTS], [myPosts, remotePosts]);

  // Opening Community (re)posts anything shared while offline, then loads everyone else's
  const profileName = state.profile?.name ?? '';
  const profilePhoto = state.profile?.photoUri ?? null;
  const avatarUrl = state.profile?.avatarUrl ?? null;
  useEffect(() => {
    if (tab !== 'community' || !communityReady || !profileName) return;
    let live = true;
    // A photo picked offline uploads here, before the posts that show it
    const avatar =
      profilePhoto && !avatarUrl
        ? uploadAvatar(profilePhoto)
            .then((url) => {
              setState((prev) => (prev.profile ? { ...prev, profile: { ...prev.profile, avatarUrl: url } } : prev));
              return url;
            })
            .catch(() => null)
        : Promise.resolve(avatarUrl);
    avatar
      .then((url) => publish(myPosts, profileName, url))
      .then(fetchPosts)
      .then((fetched) => {
        if (!live) return;
        setRemotePosts(fetched);
        setCommunityError(null);
      })
      .catch((err) => live && setCommunityError(err instanceof Error ? err.message : 'Couldn’t reach Community.'));
    return () => {
      live = false;
    };
  }, [tab, myPosts, profileName, profilePhoto, avatarUrl]);

  useEffect(() => {
    try {
      const bundled = new File(Paths.document, 'field_sample.jpg');
      bundled.write(FIELD_SAMPLE_BASE64, { encoding: 'base64' });
      setOfflineReady(isBioClipModelDownloaded() && isGemmaDownloaded());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the app');
    }
    loadState()
      .then((loaded) => {
        setState(loaded);
        // The phone may have stopped the GPS service while the app was closed; pick the trek back up.
        // With no trek in progress, make sure no service is left running the battery down.
        if (loaded.treks.some((t) => t.status === 'active')) startTracking(false).then(setTrackingError);
        else stopTracking(0);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load saved data'))
      .finally(() => setStateLoaded(true));
  }, []);

  // Saving here, not in the updater, keeps state updates pure; the guard stops the empty initial state overwriting the file
  useEffect(() => {
    if (stateLoaded) saveState(state);
  }, [state, stateLoaded]);

  useEffect(() => applyTheme(state.theme), [state.theme]);
  useEffect(() => {
    if (communityReady) currentEmail().then(setEmail);
  }, []);

  // A password-reset email link opens the app (cold or warm); it signs in and asks for a new password
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    const handle = (url: string | null) => {
      if (url) openRecoveryLink(url).then((ok) => ok && setRecovering(true));
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);
  useEffect(() => applyAccent(state.accent), [state.accent]);
  useEffect(() => applyUnits(state.units), [state.units]);

  const go = useCallback((next: View_, direction: 'forward' | 'backward') => {
    setPushDirection(direction);
    setView(next);
  }, []);

  const closeIdentify = useCallback(() => {
    setResult(null);
    setPhotoUri(null);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editingProfile) {
        setEditingProfile(false);
        return true;
      }
      if (photoUri) {
        // Identifying can't be cancelled midway; once there's a result, back closes it
        if (!step) closeIdentify();
        return true;
      }
      if (tab === 'community' && openPost) {
        setOpenPost(null);
        return true;
      }
      if (tab === 'start' && view !== 'explore') {
        go('explore', 'backward');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [editingProfile, photoUri, step, tab, view, openPost, go, closeIdentify]);

  /** Photo → BioCLIP → safety layer → Gemma notes (confident results only) → pinned on the active trek. */
  const identify = useCallback(async (uri: string) => {
    setPhotoUri(uri);
    setResult(null);
    setError(null);
    setStep('Looking closely…');
    try {
      const bio = await classifyWithBioClip(uri);
      const safety = evaluateSafety(bio.topCandidates, DEFAULT_COSINE_FLOOR);
      let notes: GemmaCard | null = null;
      let gemmaMs = 0;
      if (!safety.isUncertain && isGemmaDownloaded()) {
        setStep('Writing field notes…');
        try {
          const completion = await completeJson(buildGemmaPrompt(safety.topCandidates), cardJsonSchema, 100);
          gemmaMs = completion.durationMs;
          notes = parseGemmaCard(completion.rawText);
        } catch (gemmaErr) {
          // The card is complete without notes; safety content never depends on Gemma
          console.warn('[identify] Gemma notes failed:', gemmaErr);
        }
      }
      setResult({ safety, notes, totalMs: bio.preprocessTimeMs + bio.inferenceTimeMs + gemmaMs });

      if (!activeTrek) return;
      const takenAt = Date.now();
      const fix = await currentFix(activeTrek.startedAt ?? 0);
      const kept = keepPhoto(uri, takenAt);
      setState((prev) =>
        addSighting(prev, {
          kind: 'species',
          photoUri: kept,
          label: safety.isUncertain ? 'Not sure' : safety.title,
          danger: safety.isUncertain ? 'uncertain' : safety.dangerLevel,
          takenAt,
          lat: fix?.lat ?? null,
          lng: fix?.lng ?? null,
        }),
      );
    } catch (err) {
      setPhotoUri(null);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setStep(null);
    }
  }, [activeTrek]);

  const pick = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        const res =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
        const uri = res.canceled ? undefined : res.assets[0]?.uri;
        if (uri) await identify(uri);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open the photo');
      }
    },
    [identify],
  );

  /** A view worth remembering: no identification, just the photo pinned where it was taken. */
  const saveView = useCallback(async () => {
    if (!activeTrek) return;
    try {
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      const uri = res.canceled ? undefined : res.assets[0]?.uri;
      if (!uri) return;
      const takenAt = Date.now();
      const fix = await currentFix(activeTrek.startedAt ?? 0);
      const kept = keepPhoto(uri, takenAt);
      setState((prev) =>
        addSighting(prev, {
          kind: 'scenery',
          photoUri: kept,
          label: 'View',
          danger: 'harmless',
          takenAt,
          lat: fix?.lat ?? null,
          lng: fix?.lng ?? null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the view');
    }
  }, [activeTrek]);

  const toggleThreads = useCallback(() => {
    const next = threadCount === 4 ? 2 : 4;
    setGemmaThreadCount(next);
    setThreadCount(next);
  }, [threadCount]);

  const runCalibration = useCallback(async () => {
    setCalibrating(true);
    const rows: CalibrationItem[] = [];
    try {
      for (const s of SAMPLES) {
        const res = await classifyWithBioClip(new File(Paths.document, s.file).uri);
        const top = res.topCandidates[0];
        rows.push({
          name: s.name,
          topLabel: top?.label ?? 'None',
          score: top?.score ?? 0,
          rawCosine: top?.rawCosine ?? 0,
          durationMs: res.preprocessTimeMs + res.inferenceTimeMs,
        });
        setCalibration([...rows]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed');
    } finally {
      setCalibrating(false);
    }
  }, []);

  const beginTrek = useCallback(
    (trekId: string | null, gear?: GearItem[]) => {
      setState((prev) => startTrek(prev, trekId, Date.now(), gear));
      setError(null);
      setTrackingError(null);
      go('trek', 'forward');
      startTracking(true).then(setTrackingError);
    },
    [go],
  );

  const finishTrek = useCallback(async () => {
    const id = activeTrek?.id ?? null;
    const points = await stopTracking(activeTrek?.startedAt ?? 0);
    setState((prev) => endTrek(prev, Date.now(), trackStats(points), simplify(points, ROUTE_POINTS)));
    setTrackingError(null);
    setOpenTrekId(id);
    go(id ? 'summary' : 'explore', 'forward');
  }, [activeTrek, go]);

  /** Server first: if posts can't be taken down, keep everything rather than orphan them. */
  const deleteEverything = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      await stopTracking(0);
      wipeLocalData();
      setRemotePosts([]);
      setTab('start');
      setView('explore');
      setState(EMPTY_STATE);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Couldn’t delete your account.');
    } finally {
      setDeleting(false);
    }
  }, []);

  const ready = fontsLoaded && stateLoaded && email !== undefined;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  if (recovering) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: TOP_INSET + 24, paddingHorizontal: 20, paddingBottom: 48 }}
        >
          <AccountStep
            initialMode="reset"
            onDone={() => {
              setRecovering(false);
              currentEmail().then(setEmail);
            }}
          />
        </ScrollView>
      </View>
    );
  }

  // Has a profile on this phone but isn't signed in (signed out, or from before accounts existed)
  if (state.profile !== null && communityReady && email === null && !editingProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: TOP_INSET + 24, paddingHorizontal: 20, paddingBottom: 48 }}
        >
          <AccountStep onDone={() => currentEmail().then(setEmail)} />
        </ScrollView>
      </View>
    );
  }

  if (state.profile === null || editingProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <OnboardingScreen
          topInset={TOP_INSET}
          editMode={editingProfile}
          initialProfile={state.profile}
          onComplete={(profile: Profile) => {
            if (communityReady) currentEmail().then(setEmail);
            setState((prev) => ({ ...prev, profile }));
            setEditingProfile(false);
          }}
          onCancel={() => setEditingProfile(false)}
        />
      </View>
    );
  }

  const openTrek: Trek | undefined = allTreks.find((t) => t.id === openTrekId);

  const screen = photoUri ? (
    <PushTransition direction="forward" key="identify">
      <IdentifyScreen
        topInset={TOP_INSET}
        photoUri={photoUri}
        step={step}
        result={result}
        profile={state.profile}
        backLabel={tab === 'settings' ? 'Back to profile' : 'Back to trek'}
        onDone={closeIdentify}
      />
    </PushTransition>
  ) : tab === 'start' ? (
    <TabTransition key="start">
      <PushTransition direction={pushDirection} key={view}>
        {view === 'plan' ? (
          <PlanScreen
            topInset={TOP_INSET}
            template={planTemplate}
            checklists={state.checklists}
            onBrowseCommunity={() => setTab('community')}
            onSave={(trek) => {
              setState((prev) => ({ ...prev, treks: [trek, ...prev.treks] }));
              go('explore', 'backward');
            }}
            onCancel={() => go('explore', 'backward')}
          />
        ) : view === 'trek' && activeTrek ? (
          <TrekScreen
            topInset={TOP_INSET}
            trek={activeTrek}
            trackingError={trackingError}
            error={error}
            onTakePhoto={() => pick('camera')}
            onPickPhoto={() => pick('gallery')}
            onSaveView={saveView}
            onEndTrek={finishTrek}
            onGoHome={() => go('explore', 'backward')}
          />
        ) : view === 'summary' && openTrek ? (
          <SummaryScreen
            topInset={TOP_INSET}
            trek={openTrek}
            onBack={() => go('explore', 'backward')}
            onSetShared={(shared) => {
              setState((prev) => setShared(prev, openTrek.id, shared));
              if (shared) {
                // Stays "Posted" on the phone even offline; Community retries next time it opens
                publish([{ ...openTrek, shared }], state.profile?.name ?? 'Hiker', state.profile?.avatarUrl ?? null).catch((err) =>
                  setCommunityError(err instanceof Error ? err.message : 'Couldn’t post.'),
                );
              } else {
                unpublish(openTrek).catch((err) => {
                  // It's still public, so say so instead of pretending it's private
                  setState((prev) => setShared(prev, openTrek.id, true));
                  setCommunityError(err instanceof Error ? err.message : 'Couldn’t make it private.');
                });
              }
            }}
          />
        ) : (
          <ExploreScreen
            topInset={TOP_INSET}
            profile={state.profile}
            treks={state.treks}
            onPlanTrek={() => {
              setPlanTemplate(null);
              go('plan', 'forward');
            }}
            onBrowseCommunity={() => setTab('community')}
            onStartNow={() => beginTrek(null)}
            onResumeTrek={() => go('trek', 'forward')}
            onStartPlannedTrek={(id) => setPreflight(state.treks.find((t) => t.id === id) ?? null)}
            onOpenTrek={(id) => {
              setOpenTrekId(id);
              go('summary', 'forward');
            }}
          />
        )}
      </PushTransition>
    </TabTransition>
  ) : tab === 'community' && openPost ? (
    <PushTransition direction="forward" key={`post-${openPost.id}`}>
      <SummaryScreen
        topInset={TOP_INSET}
        trek={openPost}
        backLabel="Community"
        onBack={() => setOpenPost(null)}
        onSetShared={(shared) => setState((prev) => setShared(prev, openPost.id, shared))}
        onPlanRoute={() => {
          setPlanTemplate(openPost);
          setOpenPost(null);
          setTab('start');
          go('plan', 'forward');
        }}
      />
    </PushTransition>
  ) : tab === 'community' ? (
    <TabTransition key="community">
      <CommunityScreen
        topInset={TOP_INSET}
        userName={state.profile.name}
        userPhoto={state.profile.photoUri}
        posts={posts}
        error={communityError}
        filters={postFilters}
        onChangeFilters={setPostFilters}
        onOpen={setOpenPost}
      />
    </TabTransition>
  ) : (
    <TabTransition key="settings">
      <ProfileScreen
        topInset={TOP_INSET}
        profile={state.profile}
        onEditProfile={() => setEditingProfile(true)}
        theme={state.theme}
        onSetTheme={(theme) => setState((prev) => ({ ...prev, theme }))}
        units={state.units}
        onSetUnits={(units) => setState((prev) => ({ ...prev, units }))}
        accent={state.accent}
        onSetAccent={(accent) => setState((prev) => ({ ...prev, accent }))}
        checklists={state.checklists}
        onChangeChecklists={(checklists) => setState((prev) => ({ ...prev, checklists }))}
        offlineReady={offlineReady}
        busy={calibrating || step !== null}
        threadCount={threadCount}
        onToggleThreads={toggleThreads}
        samples={SAMPLES}
        onTrySample={(file) => identify(new File(Paths.document, file).uri)}
        calibration={calibration}
        onRunCalibration={runCalibration}
        onDeleteAccount={deleteEverything}
        email={email ?? null}
        onSignOut={() => {
          signOut()
            .then(() => setEmail(null))
            .catch((err) => setDeleteError(err instanceof Error ? err.message : 'Couldn’t sign out.'));
        }}
        deleting={deleting}
        deleteError={deleteError}
      />
    </TabTransition>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {screen}
      {/* Solid strip so scrolled content never runs under the clock */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_INSET, backgroundColor: colors.background }} />
      <PreflightScreen
        trek={preflight}
        onCancel={() => setPreflight(null)}
        onGo={(gear) => {
          const id = preflight?.id ?? null;
          setPreflight(null);
          setTab('start');
          beginTrek(id, gear);
        }}
      />
      <PillNav
        active={tab}
        onSelect={(next) => {
          if (photoUri && !step) closeIdentify();
          setTab(next);
        }}
      />
    </View>
  );
}
