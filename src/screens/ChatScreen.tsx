import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Btn, Card } from '../components';
import { loadMessages, sendMessage, subscribeToMessages } from '../store';
import { colors, radius } from '../theme';
import { AuthUser, ChatMessage, Job } from '../types';

type Props = {
  job: Job;
  user: AuthUser;
  onBack: () => void;
};

export default function ChatScreen({ job, user, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const otherName = job.createdBy === user.id ? job.workerName || 'The worker' : job.requesterName;

  useEffect(() => {
    let active = true;
    loadMessages(job.id).then((loaded) => {
      if (active) {
        setMessages(loaded);
      }
    });
    const unsubscribe = subscribeToMessages(job.id, (incoming) => {
      setMessages((current) => (current.some((m) => m.id === incoming.id) ? current : [...current, incoming]));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [job.id]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) {
      return;
    }
    setSending(true);
    setText('');
    try {
      const sent = await sendMessage(job.id, body);
      if (sent) {
        setMessages((current) => (current.some((m) => m.id === sent.id) ? current : [...current, sent]));
      } else {
        setText(body);
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <View>
      <Btn label="Back to job" onPress={onBack} color={colors.ink} small style={styles.back} />

      <Card style={styles.chatCard}>
        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.subtitle}>{`Chat with ${otherName}`}</Text>

        <View style={styles.thread}>
          {messages.length === 0 ? (
            <Text style={styles.empty}>
              No messages yet. Agree on timing, exact address, and any tools needed before the work starts.
            </Text>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === user.id;
              return (
                <View key={message.id} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine && <Text style={styles.sender}>{message.senderName}</Text>}
                  <Text style={styles.body}>{message.body}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Write a message"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void send()}
            returnKeyType="send"
          />
          <Btn label={sending ? '...' : 'Send'} onPress={() => void send()} small style={styles.sendButton} />
        </View>

        <Text style={styles.safety}>Keep payments and agreements inside the chat so there is a record.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    marginTop: 18,
    minWidth: 110,
  },
  chatCard: {
    marginTop: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
  thread: {
    gap: 8,
    marginTop: 16,
    minHeight: 200,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  bubble: {
    borderRadius: radius,
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.softBrand,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.softGrey,
  },
  sender: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  composer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: radius,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  sendButton: {
    minWidth: 84,
  },
  safety: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 12,
  },
});
