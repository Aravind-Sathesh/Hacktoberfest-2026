import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts } from './theme';
import { Mono } from './ui';

type Props = {
  /** Every known tag; empty when the problemset couldn't load, and then any typed text is accepted. */
  tags: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  accent: string;
};

const MAX_MATCHES = 6;

/** Search box with a dropdown of matching tags; the chosen ones sit above it as removable chips. */
export function TagPicker({ tags, selected, onChange, accent }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = q
    ? tags.filter((t) => t.toLowerCase().includes(q) && !selected.includes(t)).slice(0, MAX_MATCHES)
    : [];
  const freeText = tags.length === 0 && q && !selected.includes(q) ? q : null;

  const add = (tag: string) => {
    onChange([...selected, tag]);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={`stop skipping ${tag}`}
              onPress={() => onChange(selected.filter((t) => t !== tag))}
              style={[styles.chip, { borderColor: accent, backgroundColor: `${accent}26` }]}
            >
              <Mono size={12} color={accent}>{tag}</Mono>
              <Feather name="x" size={14} color={accent} />
            </Pressable>
          ))}
        </View>
      )}
      <TextInput
        accessibilityLabel="search tags to skip"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => {
          const first = matches[0] ?? freeText;
          if (first) add(first);
        }}
        placeholder={tags.length ? 'search tags, e.g. dp' : 'type a tag exactly, e.g. dp'}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        style={styles.input}
      />
      {(matches.length > 0 || freeText) && (
        <View style={styles.dropdown}>
          {(freeText ? [freeText] : matches).map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={`skip ${tag}`}
              onPress={() => add(tag)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.border }]}
            >
              <Feather name="plus" size={14} color={colors.muted} />
              <Mono>{tag}</Mono>
            </Pressable>
          ))}
        </View>
      )}
      {q && !matches.length && !freeText && <Mono color={colors.muted} size={12}>no tag matches "{query.trim()}".</Mono>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  input: {
    minHeight: 44,
    color: colors.foreground,
    fontFamily: fonts.regular,
    fontSize: 14,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  dropdown: { backgroundColor: colors.background, borderRadius: 10, overflow: 'hidden' },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
});
