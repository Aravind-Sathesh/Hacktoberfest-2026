import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { commonName, seconds } from '../format';
import { ACCENTS, radius, tint, useTheme, type AccentId } from '../theme';
import type { Units } from '../track';
import type { Checklist, Profile, ThemePref } from '../treks';
import { Avatar, Button, Card, ConfirmSheet, Input, Text } from '../ui';

const UNITS: readonly { id: Units; label: string }[] = [
  { id: 'metric', label: 'Kilometres' },
  { id: 'imperial', label: 'Miles' },
];

const THEMES: readonly {
  id: ThemePref;
  label: string;
  icon: 'moon' | 'sun' | 'smartphone';
}[] = [
  { id: 'dark', label: 'Dark', icon: 'moon' },
  { id: 'light', label: 'Light', icon: 'sun' },
  { id: 'system', label: 'Phone', icon: 'smartphone' },
];

export type Sample = { readonly file: string; readonly name: string };

export type CalibrationItem = {
  readonly name: string;
  readonly topLabel: string;
  readonly score: number;
  readonly rawCosine: number;
  readonly durationMs: number;
};

type Props = {
  topInset: number;
  profile: Profile | null;
  onEditProfile: () => void;
  theme: ThemePref;
  onSetTheme: (theme: ThemePref) => void;
  units: Units;
  onSetUnits: (units: Units) => void;
  accent: AccentId;
  onSetAccent: (accent: AccentId) => void;
  checklists: readonly Checklist[];
  onChangeChecklists: (lists: Checklist[]) => void;
  offlineReady: boolean;
  busy: boolean;
  threadCount: number;
  onToggleThreads: () => void;
  samples: readonly Sample[];
  onTrySample: (file: string) => void;
  calibration: readonly CalibrationItem[];
  onRunCalibration: () => void;
  onDeleteAccount: () => void;
  /** The signed-in account, or null when accounts aren't set up in this build. */
  email: string | null;
  onSignOut: () => void;
  deleting: boolean;
  /** One line when the Community account couldn't be deleted (nothing was removed). */
  deleteError: string | null;
};

export function ProfileScreen(props: Props) {
  const { colors, isDark } = useTheme();
  const [devOpen, setDevOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { profile } = props;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: props.topInset + 4 }]}
    >
      <Text size={28} bold>
        Profile
      </Text>

      {/* Profile Card */}
      {profile && (
        <Card>
          <View style={styles.profileHeader}>
            <Avatar uri={profile.photoUri} name={profile.name} size={56} />
            <View style={styles.flex}>
              <Text size={18} bold>
                {profile.name}
              </Text>
              <Text size={13} muted>
                {profile.experience === 'new'
                  ? 'Beginner'
                  : profile.experience === 'seasoned'
                    ? 'Seasoned hiker'
                    : 'Hikes sometimes'}
              </Text>
            </View>
            <Button
              label='Edit'
              variant='outline'
              onPress={props.onEditProfile}
            />
          </View>

          <View style={styles.infoRow}>
            <Feather name='phone' size={16} color={colors.muted} />
            <Text size={13}>
              Emergency:{' '}
              <Text size={13} bold>
                {profile.emergencyNumber}
              </Text>
            </Text>
          </View>

          {props.email && (
            <View style={styles.infoRow}>
              <Feather name='mail' size={16} color={colors.muted} />
              <Text size={13} style={styles.flex}>
                {props.email}
              </Text>
            </View>
          )}

          {profile.contact && (
            <View style={styles.infoRow}>
              <Feather name='user' size={16} color={colors.muted} />
              <Text size={13}>
                Contact:{' '}
                <Text size={13} bold>
                  {profile.contact.name}
                </Text>{' '}
                ({profile.contact.phone})
              </Text>
            </View>
          )}
        </Card>
      )}

      <Checklists
        lists={props.checklists}
        onChange={props.onChangeChecklists}
      />

      <Card>
        <Text size={18} bold>
          Appearance
        </Text>
        <View
          style={[
            styles.segments,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          {THEMES.map((t) => {
            const selected = t.id === props.theme;
            return (
              <Pressable
                key={t.id}
                accessibilityRole='radio'
                accessibilityLabel={t.label}
                accessibilityState={{ selected }}
                onPress={() => props.onSetTheme(t.id)}
                style={[
                  styles.segment,
                  selected && { backgroundColor: colors.accent },
                ]}
              >
                <Feather
                  name={t.icon}
                  size={16}
                  color={selected ? colors.onAccent : colors.muted}
                />
                <Text
                  size={13}
                  bold
                  color={selected ? colors.onAccent : colors.muted}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.swatches}>
          {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
            const selected = id === props.accent;
            const swatch = ACCENTS[id][isDark ? 'dark' : 'light'];
            return (
              <Pressable
                key={id}
                accessibilityRole='radio'
                accessibilityLabel={`${ACCENTS[id].label} accent`}
                accessibilityState={{ selected }}
                onPress={() => props.onSetAccent(id)}
                style={styles.swatchItem}
              >
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: swatch,
                      borderColor: selected ? colors.text : 'transparent',
                    },
                  ]}
                >
                  {selected && (
                    <Feather name='check' size={18} color={colors.onAccent} />
                  )}
                </View>
                <Text size={13} muted={!selected}>
                  {ACCENTS[id].label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text size={18} bold>
          Units
        </Text>
        <View
          style={[
            styles.segments,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          {UNITS.map((u) => {
            const selected = u.id === props.units;
            return (
              <Pressable
                key={u.id}
                accessibilityRole='radio'
                accessibilityLabel={u.label}
                accessibilityState={{ selected }}
                onPress={() => props.onSetUnits(u.id)}
                style={[
                  styles.segment,
                  selected && { backgroundColor: colors.accent },
                ]}
              >
                <Text
                  size={13}
                  bold
                  color={selected ? colors.onAccent : colors.muted}
                >
                  {u.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Pressable
          accessibilityRole='button'
          accessibilityLabel='For developers'
          accessibilityState={{ expanded: devOpen }}
          onPress={() => setDevOpen(!devOpen)}
          style={styles.disclosure}
        >
          <Text size={18} bold>
            For developers
          </Text>
          <Feather
            name={devOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={colors.muted}
          />
        </Pressable>
        {devOpen && <DevTools {...props} />}
      </Card>

      <View style={styles.dangerZone}>
        {props.deleteError && (
          <Text size={13} color={colors.dangerous}>
            {props.deleteError}
          </Text>
        )}
        {props.email && (
          <Button
            label='Sign out'
            icon='log-out'
            variant='outline'
            onPress={props.onSignOut}
          />
        )}
        <Button
          label={props.deleting ? 'Deleting…' : 'Delete account'}
          icon='trash-2'
          variant='outline'
          color={colors.dangerous}
          disabled={props.deleting}
          onPress={() => setConfirmDelete(true)}
        />
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        title='Delete your account?'
        body="This removes your profile, treks, photos and views from this phone, and takes down everything you posted to Community. It can't be undone."
        confirmLabel='Delete everything'
        cancelLabel='Keep my account'
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          props.onDeleteAccount();
        }}
      />
    </ScrollView>
  );
}

/** Reusable packing templates; Plan a trek copies one and edits the copy. */
function Checklists({
  lists,
  onChange,
}: {
  lists: readonly Checklist[];
  onChange: (lists: Checklist[]) => void;
}) {
  const { colors } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const update = (id: string, fn: (l: Checklist) => Checklist) =>
    onChange(lists.map((l) => (l.id === id ? fn(l) : l)));
  const addItem = (id: string) => {
    const item = draft.trim();
    if (!item) return;
    update(id, (l) =>
      l.items.includes(item) ? l : { ...l, items: [...l.items, item] },
    );
    setDraft('');
  };
  const addList = () => {
    const id = String(Date.now());
    onChange([...lists, { id, name: 'New checklist', items: [] }]);
    setOpenId(id);
  };

  return (
    <Card>
      <Text size={18} bold>
        Checklist templates
      </Text>
      <Text size={13} muted>
        Starting points for Plan a trek. Each trek gets its own copy to change.
      </Text>
      {lists.map((list) => {
        const open = list.id === openId;
        return (
          <View
            key={list.id}
            style={[styles.list, { borderColor: colors.border }]}
          >
            <Pressable
              accessibilityRole='button'
              accessibilityLabel={`${list.name}, ${list.items.length} items`}
              accessibilityState={{ expanded: open }}
              onPress={() => setOpenId(open ? null : list.id)}
              style={styles.disclosure}
            >
              <View style={styles.flex}>
                <Text bold>{list.name}</Text>
                <Text size={13} muted>
                  {list.items.length}{' '}
                  {list.items.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <Feather
                name={open ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.muted}
              />
            </Pressable>
            {open && (
              <View style={styles.dev}>
                <Input
                  label='Name'
                  value={list.name}
                  maxLength={40}
                  onChangeText={(name) =>
                    update(list.id, (l) => ({ ...l, name }))
                  }
                />
                {list.items.map((item) => (
                  <View key={item} style={styles.itemRow}>
                    <Text style={styles.flex}>{item}</Text>
                    <Pressable
                      accessibilityRole='button'
                      accessibilityLabel={`Remove ${item}`}
                      onPress={() =>
                        update(list.id, (l) => ({
                          ...l,
                          items: l.items.filter((i) => i !== item),
                        }))
                      }
                      style={styles.iconButton}
                    >
                      <Feather name='x' size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                <View style={styles.itemRow}>
                  <View style={styles.flex}>
                    <Input
                      value={draft}
                      onChangeText={setDraft}
                      placeholder='Add an item, e.g. Rain jacket'
                      maxLength={40}
                      onSubmitEditing={() => addItem(list.id)}
                      returnKeyType='done'
                    />
                  </View>
                  <Pressable
                    accessibilityRole='button'
                    accessibilityLabel='Add item'
                    onPress={() => addItem(list.id)}
                    style={[
                      styles.iconButton,
                      { backgroundColor: tint(colors.accent, 15) },
                    ]}
                  >
                    <Feather name='plus' size={20} color={colors.accent} />
                  </Pressable>
                </View>
                {lists.length > 1 && (
                  <Button
                    label='Delete this template'
                    icon='trash-2'
                    variant='outline'
                    color={colors.dangerous}
                    onPress={() =>
                      onChange(lists.filter((l) => l.id !== list.id))
                    }
                  />
                )}
              </View>
            )}
          </View>
        );
      })}
      <Button
        label='New template'
        icon='plus'
        variant='outline'
        onPress={addList}
      />
    </Card>
  );
}

function DevTools({
  offlineReady,
  busy,
  threadCount,
  onToggleThreads,
  samples,
  onTrySample,
  calibration,
  onRunCalibration,
}: Props) {
  return (
    <View style={styles.dev}>
      <Text size={13} muted>
        Models:{' '}
        {offlineReady
          ? 'BioCLIP and Gemma on the phone'
          : 'missing, push them with adb (SPIKE.md)'}
      </Text>
      <View style={styles.devRow}>
        <View style={styles.flex}>
          <Text>Gemma threads</Text>
          <Text size={13} muted>
            Tap to switch between 2 and 4
          </Text>
        </View>
        <Button
          label={`${threadCount} threads`}
          variant='outline'
          onPress={onToggleThreads}
        />
      </View>

      <Text bold>Sample photos</Text>
      <View style={styles.wrap}>
        {samples.map((s) => (
          <Button
            key={s.file}
            label={s.name}
            variant='outline'
            disabled={busy}
            onPress={() => onTrySample(s.file)}
          />
        ))}
      </View>

      <Button
        label={busy ? 'Running…' : 'Run calibration (floor 0.28)'}
        icon='target'
        disabled={busy}
        onPress={onRunCalibration}
      />
      {calibration.map((c) => (
        <View key={c.name} style={styles.devRow}>
          <View style={styles.flex}>
            <Text bold>{c.name}</Text>
            <Text size={13} muted>
              {commonName(c.topLabel)} · {Math.round(c.score * 100)}%
            </Text>
          </View>
          <Text size={13} muted>
            cos {c.rawCosine.toFixed(3)} · {seconds(c.durationMs)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dangerZone: { gap: 8, marginTop: 8 },
  segments: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  page: { paddingHorizontal: 20, paddingBottom: 128, gap: 16 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dev: { gap: 14 },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchItem: { alignItems: 'center', gap: 6, minWidth: 56 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
