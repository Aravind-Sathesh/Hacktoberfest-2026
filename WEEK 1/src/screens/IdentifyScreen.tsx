import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { GemmaCard } from '../card';
import { commonName, matchLabel, seconds } from '../format';
import type { SafetyCardModel } from '../safety';
import { radius, tint, useTheme } from '../theme';
import type { Profile } from '../treks';
import { Button, Card, DangerBadge, IconBubble, Text, useDangerColor, type IconName } from '../ui';

export type IdResult = {
  readonly safety: SafetyCardModel;
  readonly notes: GemmaCard | null;
  readonly totalMs: number;
};

type Props = {
  topInset: number;
  photoUri: string;
  step: string | null;
  result: IdResult | null;
  profile: Profile;
  backLabel: string;
  onDone: () => void;
};

/** Identifying spinner, then the safety-first species card. Shown over whichever screen started it. */
export function IdentifyScreen({ topInset, photoUri, step, result, profile, backLabel, onDone }: Props) {
  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset + 4 }]}>
      {result && !step ? (
        <Result result={result} photoUri={photoUri} profile={profile} onReset={onDone} backLabel={backLabel} />
      ) : (
        <Working photoUri={photoUri} step={step ?? 'Looking closely…'} />
      )}
    </ScrollView>
  );
}

function Working({ photoUri, step }: { photoUri: string; step: string }) {
  const { colors } = useTheme();
  return (
    <>
      <Text size={28} bold>
        Identifying…
      </Text>
      <View>
        <Image source={{ uri: photoUri }} style={styles.photo} />
        <View style={styles.scrim}>
          <ActivityIndicator size="large" color={colors.onAccent} />
          <Text size={18} bold color={colors.onAccent}>
            {step}
          </Text>
        </View>
      </View>
    </>
  );
}

function Result({
  result,
  photoUri,
  profile,
  onReset,
  backLabel,
}: {
  result: IdResult;
  photoUri: string;
  profile: Profile;
  onReset: () => void;
  backLabel: string;
}) {
  const { colors } = useTheme();
  const { safety, notes, totalMs } = result;
  const level = safety.isUncertain ? 'uncertain' : safety.dangerLevel;
  const dangerColor = useDangerColor(level);

  const emergencyPhone = profile.emergencyNumber || safety.snakeArachnidSafety?.emergencyNumber || '112';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onReset}
        style={styles.back}
      >
        <Feather name="arrow-left" size={20} color={colors.text} />
        <Text bold>{backLabel}</Text>
      </Pressable>

      <View>
        <Image source={{ uri: photoUri }} style={styles.photo} />
        <View style={styles.badgeOnPhoto}>
          <DangerBadge level={level} solid />
        </View>
      </View>

      {safety.isUncertain ? (
        <View style={styles.titleBlock}>
          <Text size={28} bold>
            Not sure what this is
          </Text>
          <Text muted>We couldn't identify it with confidence. Treat it with caution.</Text>
        </View>
      ) : (
        <View style={styles.titleBlock}>
          <Text size={28} bold>
            {commonName(safety.title)}
          </Text>
          {safety.scientificName && (
            <Text italic muted>
              {safety.scientificName}
            </Text>
          )}
          <Text size={13} muted>
            {matchLabel(safety.confidenceScore)}
          </Text>
        </View>
      )}

      {safety.snakeArachnidSafety && (
        <Card style={{ backgroundColor: tint(dangerColor, 10), borderColor: tint(dangerColor, 35) }}>
          <View style={styles.row}>
            <IconBubble icon="shield" color={dangerColor} />
            <Text size={18} bold>
              Stay safe
            </Text>
          </View>
          <Text>{safety.snakeArachnidSafety.distanceRule}</Text>
          <Text bold>If someone is bitten</Text>
          {safety.snakeArachnidSafety.ifBitten.map((stepText, i) => (
            <View key={stepText} style={styles.stepRow}>
              <Text bold color={dangerColor}>
                {i + 1}.
              </Text>
              <Text style={styles.flex}>{stepText}</Text>
            </View>
          ))}
          <Button
            label={`Call ${emergencyPhone}`}
            icon="phone"
            color={colors.dangerous}
            onPress={() => Linking.openURL(`tel:${emergencyPhone}`)}
          />
          {profile.contact && (
            <Button
              label={`Call ${profile.contact.name}`}
              icon="phone"
              variant="outline"
              color={colors.dangerous}
              onPress={() => Linking.openURL(`tel:${profile.contact?.phone}`)}
            />
          )}
        </Card>
      )}

      {safety.edibilityWarning && (
        <Card style={{ backgroundColor: tint(colors.dangerous, 8), borderColor: tint(colors.dangerous, 30) }}>
          <View style={styles.row}>
            <IconBubble icon="alert-triangle" color={colors.dangerous} />
            <Text size={18} bold style={styles.flex}>
              {safety.edibilityWarning}
            </Text>
          </View>
          {safety.plantDisclaimer && <Text muted>{safety.plantDisclaimer}</Text>}
        </Card>
      )}

      {safety.isUncertain ? (
        <Card>
          <Text size={18} bold>
            It could be one of these
          </Text>
          {safety.topCandidates.slice(0, 3).map((c) => (
            <View key={c.label} style={styles.candidate}>
              <View style={styles.flex}>
                <Text bold>{commonName(c.label)}</Text>
                {c.scientific_name && (
                  <Text size={13} italic muted>
                    {c.scientific_name}
                  </Text>
                )}
              </View>
              <Text muted>{Math.round(c.score * 100)}%</Text>
            </View>
          ))}
        </Card>
      ) : (
        notes && (
          <Card>
            <Note icon="info" title="What it is" body={notes.what} />
            <Note icon="copy" title="Look-alikes" body={notes.lookalikes} />
            <Note icon="navigation" title="What to do" body={notes.action} />
          </Card>
        )
      )}

      <Text size={13} muted center>
        Identified on your phone in {seconds(totalMs)}, no internet used.
      </Text>
      <Button label={backLabel} icon="arrow-left" variant="outline" onPress={onReset} />
    </>
  );
}

function Note({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.tip}>
      <IconBubble icon={icon} color={colors.accent} size={36} />
      <View style={styles.flex}>
        <Text bold>{title}</Text>
        <Text muted>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 128, gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleBlock: { gap: 6 },
  tip: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  flex: { flex: 1 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.card,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  badgeOnPhoto: { position: 'absolute', left: 12, bottom: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, alignSelf: 'flex-start' },
  stepRow: { flexDirection: 'row', gap: 8 },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
});
