import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface AudioPlayerProps {
  audioUri?: string | null;
  audioBlob?: Blob | null;
}

export function AudioPlayer({ audioUri, audioBlob }: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [position, setPosition] = useState<number>(0);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  async function loadAndPlayAudio() {
    try {
      let uri = audioUri;

      // If we have a blob, convert it to a URI
      if (audioBlob && !uri) {
        // Create a temporary file from blob
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        
        // Save to file system
        const filename = `${FileSystem.cacheDirectory}audio_${Date.now()}.mp3`;
        await FileSystem.writeAsStringAsync(filename, dataUrl.split(',')[1], {
          encoding: FileSystem.EncodingType.Base64,
        });
        uri = filename;
      }

      if (!uri) return;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          setPosition(status.positionMillis || 0);
          setDuration(status.durationMillis || null);
          
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        }
      });

      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  }

  async function playPause() {
    if (!sound) {
      await loadAndPlayAudio();
      return;
    }

    try {
      if (isPlaying) {
      await sound.pauseAsync();
      } else {
      await sound.playAsync();
      }
    } catch (error) {
      console.error('Error playing/pausing audio:', error);
    }
  }

  async function stop() {
    if (sound) {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      setIsPlaying(false);
      setPosition(0);
    }
  }

  if (!audioUri && !audioBlob) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button} onPress={playPause}>
          <Text style={styles.buttonText}>
            {isPlaying ? 'Pause' : 'Play'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={stop}>
          <Text style={styles.buttonText}>Stop</Text>
        </TouchableOpacity>
      </View>
      {duration && (
        <Text style={styles.timeText}>
          {formatTime(position)} / {formatTime(duration)}
        </Text>
      )}
    </View>
  );
}

function formatTime(millis: number): string {
  const seconds = Math.floor(millis / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  timeText: {
    marginTop: 10,
    color: '#666',
    fontSize: 12,
  },
});

