import { Feather } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { radius, tint, useTheme } from '../theme';
import {
  Avatar,
  Button,
  IconBubble,
  Input,
  PushTransition,
  SafetyInfo,
  Text,
  useReducedMotion,
} from '../ui';
import { AccountStep } from './AccountStep';
import { isValidPhone, type Experience, type Profile } from '../treks';

type Props = {
  topInset: number;
  onComplete: (profile: Profile) => void;
  editMode?: boolean;
  initialProfile?: Profile | null;
  onCancel?: () => void;
};

const EXPERIENCES: readonly { id: Experience; label: string }[] = [
  { id: 'new', label: 'Beginner' },
  { id: 'regular', label: 'Intermediate' },
  { id: 'seasoned', label: 'Seasoned' },
];

export function OnboardingScreen({
  topInset,
  onComplete,
  editMode = false,
  initialProfile = null,
  onCancel,
}: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(editMode ? 3 : 1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Form state
  const [name, setName] = useState(initialProfile?.name ?? '');
  const [experience, setExperience] = useState<Experience>(
    initialProfile?.experience ?? 'regular',
  );
  const [emergencyNumber, setEmergencyNumber] = useState(
    initialProfile?.emergencyNumber ?? '112',
  );
  const [contactName, setContactName] = useState(
    initialProfile?.contact?.name ?? '',
  );
  const [contactPhone, setContactPhone] = useState(
    initialProfile?.contact?.phone ?? '',
  );

  const [photoUri, setPhotoUri] = useState<string | null>(
    initialProfile?.photoUri ?? null,
  );

  // Square crop, then a copy in the app's files so the library can't take it away
  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const uri = res.canceled ? undefined : res.assets[0]?.uri;
      if (!uri) return;
      const dest = new File(Paths.document, `profile-${Date.now()}.jpg`);
      new File(uri).copySync(dest);
      setPhotoUri(dest.uri);
    } catch (err) {
      console.warn('[onboarding] photo pick failed:', err);
    }
  };

  const [touched, setTouched] = useState({
    name: false,
    emergencyNumber: false,
    contactName: false,
    contactPhone: false,
  });

  const goNext = () => {
    setDirection('forward');
    setStep((s) => (s < 4 ? ((s + 1) as 2 | 3 | 4) : s));
  };

  const goBack = () => {
    if (editMode) {
      onCancel?.();
      return;
    }
    setDirection('backward');
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  };

  // Validation
  const trimmedName = name.trim();
  const isNameValid = trimmedName.length >= 1 && trimmedName.length <= 30;
  const nameError =
    touched.name && !isNameValid
      ? trimmedName.length === 0
        ? 'Name is required'
        : 'Name must be 1 to 30 characters'
      : null;

  const trimmedEmergency = emergencyNumber.trim();
  const isEmergencyValid = isValidPhone(trimmedEmergency);
  const emergencyError =
    touched.emergencyNumber && !isEmergencyValid
      ? 'Enter a valid phone number'
      : null;

  const trimmedContactName = contactName.trim();
  const trimmedContactPhone = contactPhone.trim();
  const hasContactName = trimmedContactName.length > 0;
  const hasContactPhone = trimmedContactPhone.length > 0;

  let contactError: string | null = null;
  let isContactValid = true;

  if (hasContactName && !hasContactPhone) {
    isContactValid = false;
    if (touched.contactPhone)
      contactError = 'Phone number is required when contact name is set';
  } else if (!hasContactName && hasContactPhone) {
    isContactValid = false;
    if (touched.contactName)
      contactError = 'Contact name is required when phone number is set';
  } else if (hasContactName && hasContactPhone) {
    if (!isValidPhone(trimmedContactPhone)) {
      isContactValid = false;
      if (touched.contactPhone)
        contactError = 'Enter a valid phone number for contact';
    }
  }

  const isFormValid = isNameValid && isEmergencyValid && isContactValid;

  const buildProfile = (): Profile => ({
    photoUri,
    // A new photo uploads again; an unchanged one keeps its link
    avatarUrl:
      photoUri === (initialProfile?.photoUri ?? null)
        ? (initialProfile?.avatarUrl ?? null)
        : null,
    name: trimmedName,
    experience,
    emergencyNumber: trimmedEmergency,
    contact:
      hasContactName && hasContactPhone
        ? { name: trimmedContactName, phone: trimmedContactPhone }
        : null,
  });

  const handleSaveEdit = () => {
    if (isFormValid) {
      onComplete(buildProfile());
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topInset + 4 }]}>
      {/* Top bar with back button & dots */}
      <View style={styles.topBar}>
        {step > 1 || editMode ? (
          <Pressable
            accessibilityRole='button'
            accessibilityLabel={editMode ? 'Cancel' : 'Back'}
            onPress={goBack}
            style={styles.backButton}
          >
            <Feather name='arrow-left' size={20} color={colors.text} />
            <Text bold>{editMode ? 'Cancel' : 'Back'}</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {!editMode && (
          <View style={styles.dotsRow}>
            {[1, 2, 3, 4].map((dot) => (
              <View
                key={dot}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      dot === step ? colors.accent : colors.border,
                  },
                ]}
              />
            ))}
          </View>
        )}
        <View style={styles.backPlaceholder} />
      </View>

      <PushTransition
        direction={direction}
        key={step}
        style={styles.stepContainer}
      >
        {step === 1 && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.welcomeHero}>
              <IconBubble icon='compass' color={colors.accent} size={88} />
              <View style={styles.welcomeText}>
                <Text size={28} bold center>
                  Your offline trail companion
                </Text>
                <Text muted center>
                  Record your treks, save the views, and check whether a plant,
                  insect or snake is safe, all with no signal.
                </Text>
              </View>
            </View>
            <Button
              label='Get started'
              large
              onPress={goNext}
              style={styles.fullWidth}
            />
          </ScrollView>
        )}

        {step === 2 && (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps='handled'
          >
            <AccountStep onDone={goNext} />
          </ScrollView>
        )}

        {step === 3 && (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerBlock}>
              <Text size={28} bold>
                {editMode ? 'Edit profile' : 'About you'}
              </Text>
              <Text muted>
                TrailKit uses these details to keep you safe and tailor your
                offline safety cards.
              </Text>
            </View>

            <Pressable
              accessibilityRole='button'
              accessibilityLabel={
                photoUri ? 'Change profile photo' : 'Add a profile photo'
              }
              onPress={pickPhoto}
              style={styles.photoRow}
            >
              <Avatar uri={photoUri} name={name || '?'} size={72} />
              <View style={styles.flex}>
                <Text bold color={colors.accent}>
                  {photoUri ? 'Change photo' : 'Add a photo'}
                </Text>
                <Text size={13} muted>
                  Optional. Shown on the treks you post.
                </Text>
              </View>
            </Pressable>

            <Input
              label='Name'
              value={name}
              onChangeText={(text) => {
                setName(text);
                setTouched((t) => ({ ...t, name: true }));
              }}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder='Your name'
              maxLength={30}
              error={nameError}
            />

            {/* Experience */}
            <View style={styles.fieldGroup}>
              <Text bold>Experience</Text>
              <View style={styles.pillsRow}>
                {EXPERIENCES.map((exp) => {
                  const isSelected = experience === exp.id;
                  return (
                    <Pressable
                      key={exp.id}
                      accessibilityRole='button'
                      accessibilityLabel={exp.label}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setExperience(exp.id)}
                      style={[
                        styles.choicePill,
                        {
                          backgroundColor: isSelected
                            ? colors.accent
                            : colors.surface,
                          borderColor: isSelected
                            ? colors.accent
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        size={13}
                        bold
                        center
                        color={isSelected ? colors.onAccent : colors.text}
                      >
                        {exp.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label='Emergency number'
              value={emergencyNumber}
              onChangeText={(text) => {
                setEmergencyNumber(text);
                setTouched((t) => ({ ...t, emergencyNumber: true }));
              }}
              onBlur={() =>
                setTouched((t) => ({ ...t, emergencyNumber: true }))
              }
              placeholder='112'
              keyboardType='phone-pad'
              error={emergencyError}
            />

            <View style={styles.fieldGroup}>
              <Input
                label='Emergency contact (optional)'
                value={contactName}
                onChangeText={(text) => {
                  setContactName(text);
                  setTouched((t) => ({ ...t, contactName: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, contactName: true }))}
                placeholder='Contact name'
              />
              <Input
                value={contactPhone}
                onChangeText={(text) => {
                  setContactPhone(text);
                  setTouched((t) => ({ ...t, contactPhone: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, contactPhone: true }))}
                placeholder='Contact phone'
                keyboardType='phone-pad'
                error={contactError}
              />
            </View>

            {editMode ? (
              <Button
                label='Save profile'
                large
                disabled={!isFormValid}
                onPress={handleSaveEdit}
                style={styles.fullWidth}
              />
            ) : (
              <Button
                label='Continue'
                large
                disabled={!isFormValid}
                onPress={goNext}
                style={styles.fullWidth}
              />
            )}
          </ScrollView>
        )}

        {step === 4 && (
          <StepThreeBeforeYouGo
            emergencyNumber={trimmedEmergency}
            onComplete={() => onComplete(buildProfile())}
          />
        )}
      </PushTransition>
    </View>
  );
}

function StepThreeBeforeYouGo({
  emergencyNumber,
  onComplete,
}: {
  emergencyNumber: string;
  onComplete: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerBlock}>
        <Text size={28} bold>
          Before you go
        </Text>
        <Text muted>
          Review these offline safety and privacy principles before setting out.
        </Text>
      </View>

      <SafetyInfo emergencyNumber={emergencyNumber || '112'} />

      <ReadFirstButton label="I understand, let's go" onPress={onComplete} />
    </ScrollView>
  );
}

// Long enough to read the safety cards instead of tapping straight through
const READ_MS = 5000;

/** Starts disabled while an accent fill sweeps across, then becomes the real button. */
function ReadFirstButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setReady(false);
    fill.setValue(0);
    const timer = setTimeout(() => setReady(true), READ_MS);
    if (!reducedMotion)
      Animated.timing(fill, {
        toValue: 1,
        duration: READ_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start();
    return () => clearTimeout(timer);
  }, [fill, reducedMotion]);

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel={ready ? label : `${label}, available in a moment`}
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={onPress}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={({ pressed }) => [
        styles.readButton,
        {
          backgroundColor: ready ? colors.accent : tint(colors.accent, 18),
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {!ready && width > 0 && (
        <Animated.View
          style={[
            styles.readFill,
            {
              width,
              backgroundColor: tint(colors.accent, 45),
              transform: [
                {
                  translateX: fill.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-width, 0],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      <Text size={18} bold color={ready ? colors.onAccent : colors.text}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepContainer: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
    minHeight: 44,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingRight: 12,
  },
  backPlaceholder: { width: 60 },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 20,
  },
  welcomeHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 24,
  },
  welcomeText: {
    gap: 12,
    alignItems: 'center',
  },
  headerBlock: { gap: 6 },
  fieldGroup: { gap: 8 },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choicePill: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  fullWidth: { alignSelf: 'stretch' },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 72,
  },
  flex: { flex: 1 },
  readButton: {
    minHeight: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  readFill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
