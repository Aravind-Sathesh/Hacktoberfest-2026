import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { CfError, problemset, userInfo } from '../cf';
import { ACCENTS, type Settings, saveSettings } from '../settings';
import { colors } from '../theme';
import { TagPicker } from '../TagPicker';
import { Button, Card, Field, Mono } from '../ui';

type Props = { settings: Settings; onSaved: (settings: Settings) => void };

/** Every tag in the problemset, most common first. */
async function allTags(): Promise<string[]> {
  const counts = new Map<string, number>();
  for (const p of await problemset()) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
}

const positiveInt = (text: string) => {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function SettingsScreen({ settings, onSaved }: Props) {
  const [handle, setHandle] = useState(settings.handle);
  const [goalRating, setGoalRating] = useState(String(settings.goalRating));
  const [goalDate, setGoalDate] = useState(settings.goalDate);
  const [accent, setAccent] = useState(settings.accent);
  const [showTags, setShowTags] = useState(settings.showTags);
  const [excludedTags, setExcludedTags] = useState(settings.excludedTags);
  const [tags, setTags] = useState<string[]>([]);
  const [weekdayProblems, setWeekdayProblems] = useState(String(settings.targets.weekday.problems));
  const [weekdayMinutes, setWeekdayMinutes] = useState(String(settings.targets.weekday.minutes));
  const [weekendProblems, setWeekendProblems] = useState(String(settings.targets.weekend.problems));
  const [weekendMinutes, setWeekendMinutes] = useState(String(settings.targets.weekend.minutes));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Without the list the picker takes typed text as is.
    allTags().then(setTags, () => {});
  }, []);

  async function save() {
    const numbers = [goalRating, weekdayProblems, weekdayMinutes, weekendProblems, weekendMinutes].map(positiveInt);
    if (numbers.some((n) => n === null)) return setError('numbers must be positive whole numbers');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goalDate) || isNaN(Date.parse(goalDate))) return setError('goal date is YYYY-MM-DD');
    const [rating, wdProblems, wdMinutes, weProblems, weMinutes] = numbers as number[];

    setSaving(true);
    setError(null);
    try {
      const user = await userInfo(handle.trim());
      const next: Settings = {
        handle: user.handle,
        goalRating: rating,
        goalDate,
        accent,
        showTags,
        excludedTags,
        targets: {
          weekday: { problems: wdProblems, minutes: wdMinutes },
          weekend: { problems: weProblems, minutes: weMinutes },
        },
      };
      await saveSettings(next);
      onSaved(next);
    } catch (e) {
      setError(e instanceof CfError ? e.message : 'could not save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Mono color={colors.muted} size={12}>GOAL</Mono>
      <Card>
        <Field label="handle" value={handle} onChangeText={setHandle} />
        <Field label="goal rating" value={goalRating} onChangeText={setGoalRating} numeric />
        <Field label="goal date" value={goalDate} onChangeText={setGoalDate} />
      </Card>

      <Mono color={colors.muted} size={12}>DAILY TARGETS</Mono>
      <Card>
        <Field label="weekday problems" value={weekdayProblems} onChangeText={setWeekdayProblems} numeric />
        <Field label="weekday minutes" value={weekdayMinutes} onChangeText={setWeekdayMinutes} numeric />
        <Field label="weekend problems" value={weekendProblems} onChangeText={setWeekendProblems} numeric />
        <Field label="weekend minutes" value={weekendMinutes} onChangeText={setWeekendMinutes} numeric />
      </Card>

      <Mono color={colors.muted} size={12}>SKIP THESE TAGS</Mono>
      <Card>
        <TagPicker tags={tags} selected={excludedTags} onChange={setExcludedTags} accent={accent} />
      </Card>

      <Mono color={colors.muted} size={12}>LOOK</Mono>
      <Card>
        <View style={styles.row}>
          <Mono color={colors.muted}>show problem tags</Mono>
          <Switch
            accessibilityLabel="show problem tags"
            value={showTags}
            onValueChange={setShowTags}
            trackColor={{ true: accent, false: colors.border }}
            thumbColor={colors.foreground}
          />
        </View>
        <Mono color={colors.muted} style={styles.accentLabel}>accent</Mono>
        <View style={styles.swatches}>
          {ACCENTS.map((color) => (
            <Pressable
              key={color}
              accessibilityRole="radio"
              accessibilityLabel={`accent ${color}`}
              accessibilityState={{ selected: color === accent }}
              onPress={() => setAccent(color)}
              style={[styles.swatch, color === accent && { borderColor: colors.foreground }]}
            >
              <View style={[styles.dot, { backgroundColor: color }]} />
            </Pressable>
          ))}
        </View>
      </Card>

      {error && <Mono color={colors.danger}>{error}</Mono>}
      <Button label={saving ? 'checking handle…' : 'save'} icon="check" onPress={save} accent={accent} disabled={saving || !handle.trim()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 96 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  accentLabel: { marginTop: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14 },
});
