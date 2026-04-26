/**
 * Uses the browser's native Web Speech API to speak text aloud.
 * @param text The text to be spoken.
 * @param onStart Callback fired when speech begins.
 * @param onEnd Callback fired when speech ends or is cancelled.
 * @param onError Callback fired on a speech synthesis error.
 * @param onBoundary Callback fired for word and sentence boundaries.
 */
export const speak = (
  text: string,
  volume: number,
  rate: number,
  onStart: () => void, 
  onEnd: () => void, 
  onError: (event: SpeechSynthesisErrorEvent) => void,
  onBoundary: (event: SpeechSynthesisEvent) => void
): void => {
  if (!text.trim()) {
    onEnd();
    return;
  }

  // A function to ensure voices are loaded before speaking.
  const doSpeak = () => {
    // Cancel any previous speech to prevent overlap.
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    utterance.rate = rate;
    
    // Find a Chinese voice if possible.
    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find(voice => voice.lang.startsWith('zh'));
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }
    utterance.lang = 'zh-CN';

    utterance.onstart = onStart;
    utterance.onend = onEnd; // onend fires for both completion and cancellation.
    utterance.onerror = onError;
    utterance.onboundary = onBoundary;

    window.speechSynthesis.speak(utterance);
  };
  
  // The list of voices is loaded asynchronously. We may need to wait for it.
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      // Ensure onvoiceschanged doesn't fire multiple times.
      window.speechSynthesis.onvoiceschanged = null; 
      doSpeak();
    };
  } else {
    doSpeak();
  }
};

/**
 * Immediately stops any speech currently being synthesized.
 */
export const cancelSpeech = (): void => {
  window.speechSynthesis.cancel();
};