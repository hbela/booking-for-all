import { View, Text, StyleSheet } from 'react-native';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { AudioPlayer } from '@/components/AudioPlayer';
import { ConversationHistory } from '@/components/ConversationHistory';

export default function VoiceAgentScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Booking Agent</Text>
      <ConversationHistory />
      <VoiceRecorder />
      <AudioPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  processingText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 10,
    fontStyle: 'italic',
  },
});

