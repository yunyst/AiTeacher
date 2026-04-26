import { create } from 'zustand';
import { Euler } from 'three';
import type { AppState, Blendshapes } from '../types';
import { VISEMES } from '../types';
import { AudioProcessor } from '../lib/AudioProcessor';
import { speak, cancelSpeech } from '../services/ttsService';

// REFACTOR: The animation logic is now driven by word-boundary events from the SpeechSynthesis API.
// A timeout is used to detect pauses in speech and close the avatar's mouth.
let pauseTimeoutId: number | null = null;

const useAppStore = create<AppState>((set, get) => {
  // REFACTOR: This function now resets the avatar to a silent state by clearing any pending
  // pause timeouts and resetting blendshapes to zero. It replaces the previous animation frame cancellation.
  const stopAnimationAndReset = () => {
    cancelSpeech();
    if (pauseTimeoutId) {
      clearTimeout(pauseTimeoutId);
      pauseTimeoutId = null;
    }

    const resetBlendshapes: Blendshapes = {};
    get().availableBlendshapes.forEach(name => {
      resetBlendshapes[name] = 0;
    });

    set({
      isSpeakingSentence: false,
      isSpeaking: false,
      blendshapes: resetBlendshapes,
    });
  };

  return {
    isRecording: false,
    isReady: false,
    isSpeaking: false,
    audioProcessor: null,
    blendshapes: {},
    isMuted: false,
    volume: 1,
    speechRate: 1,
    error: null,
    isTestAudioPlaying: false,
    uploadedAudioFile: null,
    isDebugAnimationRunning: false,
    activeDebugViseme: null,
    availableBlendshapes: [],
    isSpeakingSentence: false,
    headBobOffset: new Euler(0, 0, 0, 'XYZ'),

    setBlendshapes: (blendshapes) => set({ blendshapes }),
    setIsReady: (isReady) => set({ isReady }),
    toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    setVolume: (volume) => set({ volume }),
    setSpeechRate: (speechRate) => set({ speechRate }),
    setError: (error) => set({ error }),
    setAvailableBlendshapes: (names) => set({ availableBlendshapes: names }),
    setHeadBobOffset: (offset) => set({ headBobOffset: offset }),

    startRecording: async () => {},
    stopRecording: () => {},
    playTestAudio: async () => {},
    setUploadedAudio: () => {},
    runDebugAnimation: () => {},

    resetAvatarState: () => {
      stopAnimationAndReset();
    },

    // REFACTOR: The speakSentence method now uses the `onboundary` event from the SpeechSynthesis API
    // to create a more realistic and synchronized lip-sync animation.
    speakSentence: async (text: string) => {
      // Ensure any ongoing speech is fully stopped before starting a new one.
      if (get().isSpeakingSentence || window.speechSynthesis.speaking) {
        stopAnimationAndReset();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      set({ isSpeakingSentence: true, error: null });

      const onBoundary = (event: SpeechSynthesisEvent) => {
        // We only care about word boundaries to trigger animation.
        if (event.name !== 'word') {
          return;
        }

        const { availableBlendshapes } = get();
        if (availableBlendshapes.length === 0) {
            return;
        }

        // Clear any existing timeout to prevent the mouth from closing prematurely between words.
        if (pauseTimeoutId) {
          clearTimeout(pauseTimeoutId);
        }

        // Define a set of visemes that represent open-mouth talking sounds.
        const talkingVisemes = [VISEMES.aa, VISEMES.I, VISEMES.O, VISEMES.U, VISEMES.E];
        const newBlendshapes: Blendshapes = {};
        availableBlendshapes.forEach(name => { newBlendshapes[name] = 0; });

        // Pick a random viseme from the talking set to create variation.
        const activeViseme = talkingVisemes[Math.floor(Math.random() * talkingVisemes.length)];
        newBlendshapes[activeViseme] = Math.random() * 0.4 + 0.4; // Randomize intensity for a more natural look.

        // Head movement during speech is disabled by user request.
        set({ blendshapes: newBlendshapes, isSpeaking: true });

        // Set a timeout to close the mouth if no new word boundary event occurs soon.
        // This simulates a natural pause in speech.
        pauseTimeoutId = window.setTimeout(() => {
          const resetBlendshapes: Blendshapes = {};
          availableBlendshapes.forEach(name => { resetBlendshapes[name] = 0; });
          set({ blendshapes: resetBlendshapes, isSpeaking: false });
          pauseTimeoutId = null;
        }, 150); // A 150ms pause is enough to close the mouth.
      };
      
      const { volume, speechRate } = get();
      speak(
        text,
        volume,
        speechRate,
        /* onStart */ () => {
          // The onBoundary event will handle the animation, so we just confirm the speaking state here.
          set({ isSpeaking: true });
        },
        /* onEnd */ () => {
          // The stopAnimationAndReset function handles all state cleanup.
          stopAnimationAndReset();
          // Clear the Chrome keepAlive interval on speech end
          if ((window as any).__speechKeepAlive) {
            clearInterval((window as any).__speechKeepAlive);
            (window as any).__speechKeepAlive = null;
          }
        },
        /* onError */ (event) => {
          console.error("SpeechSynthesis Error:", event.error);
          set({ error: `Speech synthesis failed: ${event.error}` });
          stopAnimationAndReset();
          // Clear the Chrome keepAlive interval on speech error
          if ((window as any).__speechKeepAlive) {
            clearInterval((window as any).__speechKeepAlive);
            (window as any).__speechKeepAlive = null;
          }
        },
        /* onBoundary */ onBoundary
      );

      // Chrome workaround: Chrome silently stops speech synthesis after ~15 seconds.
      // Periodically calling resume() keeps it alive.
      if ((window as any).__speechKeepAlive) {
        clearInterval((window as any).__speechKeepAlive);
      }
      (window as any).__speechKeepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        } else if (!window.speechSynthesis.speaking) {
          // Speech has ended naturally or been cancelled; clean up
          clearInterval((window as any).__speechKeepAlive);
          (window as any).__speechKeepAlive = null;
        }
      }, 10000); // Every 10 seconds
    },
  };
});

export { useAppStore };