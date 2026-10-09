import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { radius, tint, useTheme } from '../theme';
import {
  nextDays,
  planTrek,
  type Checklist,
  type Trek,
} from '../treks';
import { hasOfflineArea, downloadOfflineArea } from '../offlineMaps';
import { formatDistance, type Route } from '../track';
import { useUnits } from '../units';
import { Button, Card, Input, Text } from '../ui';
import { TrailMap } from '../trailmap';

type Props = {
  topInset: number;
  /** A Community post whose route this plan follows. */
  template: Trek | null;
  checklists: readonly Checklist[];
  onSave: (trek: Trek) => void;
  onCancel: () => void;
  onBrowseCommunity: () => void;
};

export function PlanScreen({ topInset, template, checklists, onSave, onCancel, onBrowseCommunity }: Props) {
  const { colors } = useTheme();
  const units = useUnits();
  const now = Date.now();
  const days = nextDays(now, 7);

  const [title, setTitle] = useState(template?.title ?? '');
  const [selectedIso, setSelectedIso] = useState<string>(days[0]?.iso ?? '');
  const [listId, setListId] = useState(checklists[0]?.id ?? '');
  const [items, setItems] = useState<string[]>(() => [...(checklists[0]?.items ?? [])]);
  const [draft, setDraft] = useState('');
  const pickList = (list: Checklist) => {
    setListId(list.id);
    setItems([...list.items]);
  };
  const addItem = () => {
    const item = draft.trim();
    if (item && !items.includes(item)) setItems((prev) => [...prev, item]);
    setDraft('');
  };

  const isTitleValid = title.trim().length > 0;

  const handleSave = () => {
    if (!isTitleValid) return;
    const gear = items.map((name) => ({ name, packed: false }));
    const trek = planTrek(title.trim(), selectedIso, gear, Date.now(), template?.route ?? []);
    onSave(trek);
  };

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: topInset + 4 }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onCancel}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
          <Text bold>Back</Text>
        </Pressable>
      </View>

      <View style={styles.headerBlock}>
        <Text size={28} bold>
          Plan a trek
        </Text>
        <Text muted>
          Pick a route and a day, and what to bring.
        </Text>
      </View>

      <Card>
        <Text size={18} bold>
          Route
        </Text>
        {template ? (
          <>
            <TrailMap
              route={[]}
              planned={template.route}
              height={180}
              label={`Planned route, ${formatDistance(template.distanceM, units)}`}
            />
            <Text size={13} muted>
              {formatDistance(template.distanceM, units)}, shared by {template.author ?? 'you'}. It shows as a dashed line while you
              walk.
            </Text>
            <OfflineAreaButton id={template.id} route={template.route} />
          </>
        ) : (
          <>
            <Text size={13} muted>
              No route yet. Pick one another hiker shared, or just head out and TrailKit records yours.
            </Text>
            <Button label="Find a route in Community" icon="users" variant="outline" onPress={onBrowseCommunity} />
          </>
        )}
        <View style={[styles.soon, { borderTopColor: colors.border }]}>
          <Feather name="edit-3" size={18} color={colors.muted} />
          <Text muted style={styles.flex}>
            Design your own route
          </Text>
          <View style={[styles.soonChip, { backgroundColor: tint(colors.muted, 15) }]}>
            <Text size={13} bold muted>
              Soon
            </Text>
          </View>
        </View>
      </Card>

      <Input label="Trek name" value={title} onChangeText={setTitle} placeholder="Morning ridge walk" maxLength={60} />

      {/* Day Selector Chips */}
      <View style={styles.fieldGroup}>
        <Text bold>When are you going?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {days.map((d) => {
            const isSelected = d.iso === selectedIso;
            return (
              <Pressable
                key={d.iso}
                accessibilityRole="button"
                accessibilityLabel={d.label}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedIso(d.iso)}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                  },
                ]}
              >
                <Text
                  size={13}
                  bold
                  color={isSelected ? colors.onAccent : colors.text}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Checklist: built here, ticked off on the start screen */}
      <Card>
        <View style={styles.checklistHeader}>
          <Text size={18} bold>
            Checklist
          </Text>
          <Text size={13} muted>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Text size={13} muted>
          Start from a template, then make it fit this trek. You'll tick things off just before you start.
        </Text>

        {checklists.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
            {checklists.map((list) => {
              const isSelected = list.id === listId;
              return (
                <Pressable
                  key={list.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Start from ${list.name}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => pickList(list)}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surface,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text size={13} bold color={isSelected ? colors.onAccent : colors.text}>
                    {list.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {items.map((item) => (
          <View key={item} style={styles.itemRow}>
            <View style={[styles.bullet, { backgroundColor: colors.muted }]} />
            <Text style={styles.flex}>{item}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item}`}
              onPress={() => setItems((prev) => prev.filter((i) => i !== item))}
              style={styles.iconButton}
            >
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ))}
        <View style={styles.itemRow}>
          <View style={styles.flex}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Add an item, e.g. Rain jacket"
              maxLength={40}
              onSubmitEditing={addItem}
              returnKeyType="done"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add item"
            onPress={addItem}
            style={[styles.iconButton, { backgroundColor: tint(colors.accent, 15) }]}
          >
            <Feather name="plus" size={20} color={colors.accent} />
          </Pressable>
        </View>
      </Card>

      {/* Save Button */}
      <Button
        label="Save plan"
        large
        disabled={!isTitleValid}
        onPress={handleSave}
        style={styles.stretch}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  saved: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginLeft: 4 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, minHeight: 44 },
  soonChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  flex: { flex: 1 },
  page: { paddingHorizontal: 20, paddingBottom: 128, gap: 20 },
  topBar: { minHeight: 44, justifyContent: 'center' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  headerBlock: { gap: 6 },
  fieldGroup: { gap: 8 },
  chipsScroll: { gap: 8, paddingVertical: 4 },
  dayChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistCard: { gap: 16 },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: { gap: 4 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  checkText: { flex: 1 },
  stretch: { alignSelf: 'stretch' },
});

/** Saves the map around the route so it shows on the trail with no signal. */
function OfflineAreaButton({ id, route }: { id: string; route: Route }) {
  const { colors, isDark } = useTheme();
  const [state, setState] = useState<'idle' | 'saved' | number | string>('idle');

  useEffect(() => {
    hasOfflineArea(id, isDark).then((has) => has && setState('saved'));
  }, [id, isDark]);

  if (state === 'saved') {
    return (
      <View style={styles.saved}>
        <Feather name="check-circle" size={16} color={colors.harmless} />
        <Text size={13} color={colors.harmless}>
          Map saved for offline use
        </Text>
      </View>
    );
  }
  if (typeof state === 'number') {
    return (
      <Text size={13} muted>
        Downloading map… {state}%
      </Text>
    );
  }
  return (
    <>
      {state !== 'idle' && (
        <Text size={13} color={colors.dangerous}>
          {state}
        </Text>
      )}
      <Button
        label="Download map for offline"
        icon="download"
        variant="outline"
        onPress={() => {
          setState(0);
          downloadOfflineArea(id, route, isDark, setState)
            .then(() => setState('saved'))
            .catch((err) => setState(err instanceof Error ? err.message : 'Map download failed.'));
        }}
      />
    </>
  );
}
