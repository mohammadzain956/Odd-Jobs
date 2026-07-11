import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Btn, Card, Field } from '../components';
import { signInUser, signUpUser } from '../store';
import { colors } from '../theme';
import { AuthUser } from '../types';

type Props = {
  onDone: (user: AuthUser) => void;
  notify: (message: string) => void;
};

export default function AuthScreen({ onDone, notify }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) {
      return;
    }
    setError('');
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Enter your name.');
      return;
    }
    if (!email.trim().includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === 'signup'
          ? await signUpUser(name.trim(), email.trim(), password)
          : await signInUser(email.trim(), password);
      if (result.user) {
        onDone(result.user);
      } else if (result.message) {
        if (result.message.startsWith('Check your email')) {
          notify(result.message);
          setMode('login');
        } else {
          setError(result.message);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{mode === 'login' ? 'Log in' : 'Create your account'}</Text>
      <Text style={styles.copy}>
        {mode === 'login'
          ? 'Log in to post jobs and accept work. Your name appears on your posts.'
          : 'Your name is shown to people you work with. Use your real name.'}
      </Text>

      {mode === 'signup' && <Field placeholder="Your name" value={name} onChangeText={setName} />}
      <Field
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

      {error !== '' && <Text style={styles.error}>{error}</Text>}

      <Btn
        label={busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
        onPress={() => void submit()}
        style={styles.submit}
      />
      <Btn
        label={mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
        onPress={() => {
          setMode(mode === 'login' ? 'signup' : 'login');
          setError('');
        }}
        outline
        small
        style={styles.toggle}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: '700',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  error: {
    color: colors.action,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  submit: {
    marginTop: 16,
  },
  toggle: {
    marginTop: 10,
  },
});
