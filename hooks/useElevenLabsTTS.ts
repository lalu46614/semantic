"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseElevenLabsTTSOptions {
  enabled?: boolean;
  onVolumeUpdate?: (volume: number) => void;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onChunkStart?: (duration: number) => void;
  onChunkEnd?: () => void;
}

export function useElevenLabsTTS({ 
  enabled = true, 
  onVolumeUpdate,
  onAudioStart,
  onAudioEnd,
  onChunkStart,
  onChunkEnd,
}: UseElevenLabsTTSOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const elapsedTimeFrameRef = useRef<number | null>(null);
  const audioQueueRef = useRef<Array<{ buffer: ArrayBuffer; duration: number }>>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const pendingChunksRef = useRef<string[]>([]);
  
  // Audio timing tracking for caption synchronization
  const audioStartTimeRef = useRef<number | null>(null);
  const totalAudioDurationRef = useRef<number>(0);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);

  // Initialize audio context and analyser
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100
      });
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0; // Full volume
      gainNodeRef.current = gainNode;

      // Connect: gain -> analyser -> destination
      gainNode.connect(analyser);
      analyser.connect(audioContext.destination);

      // Start volume analysis loop
      const analyzeVolume = () => {
        if (!analyserRef.current || !onVolumeUpdate) {
          animationFrameRef.current = requestAnimationFrame(analyzeVolume);
          return;
        }

        const bufferLength = analyserRef.current.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        
        // Use time domain data for more accurate volume calculation
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate RMS volume from time domain data
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);
        // Normalize to 0-1 range, with some smoothing
        const normalizedVolume = Math.min(rms * 2, 1); // Scale up for better sensitivity

        onVolumeUpdate(normalizedVolume);
        animationFrameRef.current = requestAnimationFrame(analyzeVolume);
      };

      analyzeVolume();
    } catch (error) {
      console.error("Error initializing audio context:", error);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (elapsedTimeFrameRef.current) {
        cancelAnimationFrame(elapsedTimeFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [onVolumeUpdate]);

  // Play audio chunk using Web Audio API
  const playAudioChunk = useCallback(async (audioData: ArrayBuffer, duration: number, format: string = "mp3") => {
    if (!audioContextRef.current || !gainNodeRef.current) {
      console.warn("playAudioChunk: AudioContext or GainNode not available");
      return;
    }

    console.log(`[Audio] Received chunk: size=${audioData.byteLength} bytes, format=${format}`);

    try {
      // Resume audio context if suspended
      if (audioContextRef.current.state === "suspended") {
        console.log(`[Audio] AudioContext is suspended, resuming...`);
        await audioContextRef.current.resume();
        console.log(`[Audio] AudioContext resumed, state: ${audioContextRef.current.state}`);
      }

      console.log(`[Audio] AudioContext state: ${audioContextRef.current.state}, sampleRate: ${audioContextRef.current.sampleRate}`);
      console.log(`[Audio] Gain node value: ${gainNodeRef.current.gain.value}`);

      let audioBuffer: AudioBuffer;

      if (format === "pcm" || format === "raw") {
        console.log(`[Audio] Decoding PCM/raw audio...`);
        // Handle PCM/raw audio (assume 16-bit PCM, 44100 Hz, mono)
        // This is a simplified assumption - you may need to adjust based on actual format
        const samples = new Int16Array(audioData);
        const sampleRate = 44100;
        const numChannels = 1;
        
        audioBuffer = audioContextRef.current.createBuffer(numChannels, samples.length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        // Convert 16-bit PCM to float32 (-1 to 1)
        for (let i = 0; i < samples.length; i++) {
          channelData[i] = samples[i] / 32768.0;
        }
        console.log(`[Audio] PCM decoded: ${samples.length} samples, duration: ${audioBuffer.duration.toFixed(3)}s`);
      } else {
        console.log(`[Audio] Decoding compressed audio (${format})...`);
        // Handle MP3 or other compressed formats
        audioBuffer = await audioContextRef.current.decodeAudioData(audioData.slice(0));
        console.log(`[Audio] Decoded: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.length} samples, duration: ${audioBuffer.duration.toFixed(3)}s, sampleRate: ${audioBuffer.sampleRate}`);
      }

      // Schedule playback
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current!);

      const currentTime = audioContextRef.current.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);

      // Track audio start time for caption synchronization
      if (audioStartTimeRef.current === null) {
        audioStartTimeRef.current = startTime;
        onAudioStart?.();
      }

      // Notify chunk start with duration
      onChunkStart?.(audioBuffer.duration);

      console.log(`[Audio] Starting playback at ${startTime.toFixed(3)}s (currentTime: ${currentTime.toFixed(3)}s)`);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
      console.log(`[Audio] Playback started, next chunk scheduled at ${nextPlayTimeRef.current.toFixed(3)}s`);

      // Start continuous elapsed time tracking
      const startElapsedTimeTracking = () => {
        const updateElapsedTime = () => {
          if (audioContextRef.current && audioStartTimeRef.current !== null) {
            const elapsed = audioContextRef.current.currentTime - audioStartTimeRef.current;
            setCurrentElapsedTime(Math.max(0, elapsed));
            
            if (isPlayingRef.current || audioQueueRef.current.length > 0) {
              elapsedTimeFrameRef.current = requestAnimationFrame(updateElapsedTime);
            } else {
              elapsedTimeFrameRef.current = null;
            }
          }
        };
        // Only start if not already tracking
        if (elapsedTimeFrameRef.current === null) {
          updateElapsedTime();
        }
      };
      startElapsedTimeTracking();

      source.onended = () => {
        console.log(`[Audio] Chunk playback ended, queue length: ${audioQueueRef.current.length}`);
        onChunkEnd?.();
        
        if (audioQueueRef.current.length === 0) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          // Keep elapsed time tracking until explicitly reset
          // Don't reset here - let it continue so captions can finish
          setTimeout(() => {
            audioStartTimeRef.current = null;
            totalAudioDurationRef.current = 0;
            setCurrentElapsedTime(0);
          }, 100); // Small delay to allow final updates
          onAudioEnd?.();
        } else {
          // Play next chunk in queue
          const nextChunk = audioQueueRef.current.shift()!;
          playAudioChunk(nextChunk.buffer, nextChunk.duration, format);
        }
      };

      currentSourceRef.current = source;
      setIsPlaying(true);
      isPlayingRef.current = true;
    } catch (error) {
      console.error("[Audio] Error playing audio chunk:", error);
      setIsPlaying(false);
      isPlayingRef.current = false;
      
      // Try next chunk in queue
      if (audioQueueRef.current.length > 0) {
        const nextChunk = audioQueueRef.current.shift()!;
        playAudioChunk(nextChunk.buffer, nextChunk.duration, format);
      }
    }
  }, []);

  // Process audio queue
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    const chunk = audioQueueRef.current.shift()!;
    // Try to detect format from chunk or default to mp3
    // ElevenLabs typically sends MP3, but we'll try both
    await playAudioChunk(chunk.buffer, chunk.duration, "mp3");
  }, [playAudioChunk]);

  // Connect to ElevenLabs WebSocket
  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const voiceId = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      console.error("ElevenLabs API key or voice ID not configured");
      return;
    }

    try {
      const ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_turbo_v2_5&xi-api-key=${apiKey}`
      );

      ws.onopen = () => {
        console.log("ElevenLabs WebSocket connected");
        setIsConnected(true);

        // Send initial configuration
        ws.send(
          JSON.stringify({
            text: " ",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
            generation_config: {
              chunk_length_schedule: [120, 160, 250, 290],
            },
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          // Handle both JSON (Base64) and binary formats
          let data: any;
          let arrayBuffer: ArrayBuffer | null = null;
          let format = "mp3";

          if (event.data instanceof ArrayBuffer) {
            // Binary audio data
            console.log(`[WebSocket] Received binary audio chunk: ${event.data.byteLength} bytes`);
            arrayBuffer = event.data;
            format = "mp3"; // Assume MP3 for binary data from ElevenLabs
          } else if (typeof event.data === "string") {
            // JSON with Base64 audio
            data = JSON.parse(event.data);
            console.log(`[WebSocket] Received message:`, { 
              hasAudio: !!data.audio, 
              isFinal: data.isFinal,
              format: data.format,
              audioLength: data.audio ? data.audio.length : 0
            });
            
            if (data.audio && audioContextRef.current) {
              // Decode base64 audio
              const audioData = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
              arrayBuffer = audioData.buffer;
              format = data.format || "mp3";
              console.log(`[WebSocket] Decoded Base64 audio: ${arrayBuffer.byteLength} bytes, format: ${format}`);
            }
          }

          if (arrayBuffer && audioContextRef.current) {
            // Decode audio to get duration before queuing
            try {
              // Use existing audio context to decode
              const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));
              const duration = audioBuffer.duration;
              
              // Track total duration
              totalAudioDurationRef.current += duration;
              
              // Add to queue with duration
              audioQueueRef.current.push({ buffer: arrayBuffer, duration });
              console.log(`[WebSocket] Added to audio queue, queue length: ${audioQueueRef.current.length}, duration: ${duration.toFixed(3)}s, total: ${totalAudioDurationRef.current.toFixed(3)}s`);
              
              // Process queue if not already playing
              processAudioQueue();
            } catch (error) {
              console.error("[WebSocket] Error decoding audio for duration:", error);
              // Estimate duration based on file size if decode fails (rough estimate: ~1KB per second for MP3)
              const estimatedDuration = arrayBuffer.byteLength / 1000;
              totalAudioDurationRef.current += estimatedDuration;
              audioQueueRef.current.push({ buffer: arrayBuffer, duration: estimatedDuration });
              processAudioQueue();
            }
          }

          if (data?.isFinal) {
            console.log(`[WebSocket] Received final message, waiting for queue to finish...`);
            // Wait a bit for audio queue to finish
            setTimeout(() => {
              if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
                setIsPlaying(false);
                console.log(`[WebSocket] Audio playback completed`);
              }
            }, 500);
          }
        } catch (error) {
          console.error("[WebSocket] Error processing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("ElevenLabs WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("ElevenLabs WebSocket closed");
        setIsConnected(false);
        setIsPlaying(false);
        isPlayingRef.current = false;
        audioQueueRef.current = [];
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Error connecting to ElevenLabs:", error);
    }
  }, [enabled, processAudioQueue]);

  // Resume AudioContext (called during user interaction)
  const resumeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      console.warn("[Audio] resumeAudioContext: AudioContext not initialized");
      return;
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
        console.log(`[Audio] AudioContext resumed, state: ${audioContextRef.current.state}`);
      } catch (error) {
        console.error("[Audio] Error resuming AudioContext:", error);
      }
    } else {
      console.log(`[Audio] AudioContext already running, state: ${audioContextRef.current.state}`);
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    pendingChunksRef.current = [];
    audioQueueRef.current = [];
    
    // Stop current playback
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      currentSourceRef.current = null;
    }
    nextPlayTimeRef.current = 0;
    audioStartTimeRef.current = null;
    totalAudioDurationRef.current = 0;
    setCurrentElapsedTime(0);
    if (elapsedTimeFrameRef.current) {
      cancelAnimationFrame(elapsedTimeFrameRef.current);
      elapsedTimeFrameRef.current = null;
    }
  }, []);

  // Send text chunk to ElevenLabs
  const sendChunk = useCallback(
    (text: string, isFinal: boolean = false) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        // Queue chunk if not connected yet
        if (text.trim()) {
          pendingChunksRef.current.push(text);
        }
        if (!isConnected) {
          connect();
        }
        return;
      }

      // Send any pending chunks first
      if (pendingChunksRef.current.length > 0) {
        const pending = pendingChunksRef.current.join(" ");
        pendingChunksRef.current = [];
        wsRef.current.send(
          JSON.stringify({
            text: pending,
            try_trigger_generation: false,
          })
        );
      }

      // Send current chunk
      if (text.trim()) {
        wsRef.current.send(
          JSON.stringify({
            text: text,
            try_trigger_generation: isFinal,
          })
        );
      } else if (isFinal) {
        // Send flush command if final but no text
        wsRef.current.send(
          JSON.stringify({
            text: " ",
            try_trigger_generation: true,
          })
        );
      }
    },
    [isConnected, connect]
  );

  // Auto-connect when enabled
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Get total audio duration (sum of all queued chunks)
  const getTotalDuration = useCallback(() => {
    return totalAudioDurationRef.current;
  }, []);

  // Get current elapsed playback time
  const getElapsedTime = useCallback(() => {
    if (audioContextRef.current && audioStartTimeRef.current !== null) {
      return Math.max(0, audioContextRef.current.currentTime - audioStartTimeRef.current);
    }
    return 0;
  }, []);

  return {
    isConnected,
    isPlaying,
    sendChunk,
    connect,
    disconnect,
    resumeAudioContext,
    getTotalDuration,
    getElapsedTime,
    currentElapsedTime,
  };
}
