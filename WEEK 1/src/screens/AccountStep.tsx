import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { sendResetLink, setNewPassword, signIn, signUp } from "../posts";
import { useTheme } from "../theme";
import { Button, Input, Text } from "../ui";

// "reset" is reached only from the emailed link, which has already signed the user in
type Mode = "signup" | "signin" | "forgot" | "reset";

const TITLES: Record<Mode, [string, string]> = {
  signup: [
    "Create your account",
    "Use your email and a password. It lets you post treks and keeps your profile photo.",
  ],
  signin: [
    "Welcome back",
    "Sign in with the email and password you used before.",
  ],
  forgot: [
    "Reset your password",
    "We’ll email you a link. Open it on this phone to choose a new password.",
  ],
  reset: [
    "Choose a new password",
    "You’re signed in from the email link. Pick a new password to finish.",
  ],
};

// Enough to catch typos; the server is the real check
const looksLikeEmail = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Email + password sign-up and sign-in, with a password reset by emailed link. */
export function AccountStep({
  onDone,
  initialMode = "signup",
}: {
  onDone: () => void;
  initialMode?: Mode;
}) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailOk = looksLikeEmail(email);
  const passwordOk = password.length >= 8;
  const canSubmit =
    !busy && (mode === "reset" || emailOk) && (mode === "forgot" || passwordOk);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const e = email.trim().toLowerCase();
      if (mode === "signup") {
        if ((await signUp(e, password)) === "confirm-email") {
          switchTo("signin");
          setNotice(
            `We sent a link to ${e}. Open it to confirm your email, then sign in.`,
          );
          return;
        }
        onDone();
      } else if (mode === "signin") {
        await signIn(e, password);
        onDone();
      } else if (mode === "forgot") {
        await sendResetLink(e);
        switchTo("signin");
        setNotice(
          `If ${e} has an account, a reset link is on its way. Open it on this phone.`,
        );
      } else {
        await setNewPassword(password);
        onDone();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const [title, subtitle] = TITLES[mode];
  const label = {
    signup: "Create account",
    signin: "Sign in",
    forgot: "Send reset link",
    reset: "Save new password",
  }[mode];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text size={28} bold>
          {title}
        </Text>
        <Text muted>{subtitle}</Text>
      </View>

      {notice && (
        <View style={styles.row}>
          <Feather name="mail" size={16} color={colors.accent} />
          <Text size={13} color={colors.accent} style={styles.flex}>
            {notice}
          </Text>
        </View>
      )}

      {mode !== "reset" && (
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          error={
            email.length > 3 && !emailOk
              ? "That doesn’t look like an email address"
              : null
          }
        />
      )}
      {mode !== "forgot" && (
        <Input
          label={mode === "reset" ? "New password" : "Password"}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          textContentType={mode === "signin" ? "password" : "newPassword"}
          error={
            password.length > 0 && !passwordOk
              ? "Use at least 8 characters"
              : null
          }
        />
      )}

      {error && (
        <View style={styles.row} accessibilityRole="alert">
          <Feather name="alert-circle" size={16} color={colors.dangerous} />
          <Text size={13} color={colors.dangerous} style={styles.flex}>
            {error}
          </Text>
        </View>
      )}

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <Button label={label} large disabled={!canSubmit} onPress={submit} />
      )}

      <View style={styles.links}>
        {mode === "signup" && (
          <Link
            label="I already have an account"
            onPress={() => switchTo("signin")}
          />
        )}
        {mode === "signin" && (
          <>
            <Link label="Forgot password?" onPress={() => switchTo("forgot")} />
            <Link label="Sign Up" onPress={() => switchTo("signup")} />
          </>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <Link label="Back to sign in" onPress={() => switchTo("signin")} />
        )}
      </View>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.link}
    >
      <Text bold color={colors.accent}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  header: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  busy: { minHeight: 60, alignItems: "center", justifyContent: "center" },
  links: { alignItems: "center", gap: 4 },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
});
