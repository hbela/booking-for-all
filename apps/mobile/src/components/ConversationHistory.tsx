import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface ConversationHistoryProps {
  messages?: Message[];
}

export function ConversationHistory({ messages = [] }: ConversationHistoryProps) {
  return (
    <ScrollView style={styles.container}>
      {messages.length === 0 ? (
        <Text style={styles.emptyText}>No conversation yet. Start recording to begin!</Text>
      ) : (
        messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.message,
              message.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
            <Text style={styles.timestamp}>
              {message.timestamp.toLocaleTimeString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 20,
    maxHeight: 300,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  message: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  messageText: {
    color: '#000',
    fontSize: 14,
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
});

