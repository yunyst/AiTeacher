
import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (input: string) => void;
  isLoading: boolean;
  isDisabled: boolean;
  placeholder: string;
  onMicStart?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, isDisabled, placeholder, onMicStart }) => {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  // Fix: Use `any` for the SpeechRecognition instance type. The browser-specific
  // `SpeechRecognition` type is not available in standard TS DOM libs and a local
  // variable of the same name creates a name collision.
  const recognitionRef = useRef<any | null>(null);
  const baseTextRef = useRef('');

  // Fix: Cast `window` to `any` to access the non-standard SpeechRecognition API
  // without generating TypeScript errors.
  const SpeechRecognition = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const isSpeechRecognitionSupported = !!SpeechRecognition;

  const isEffectivelyDisabled = isLoading || isDisabled;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isEffectivelyDisabled) {
      onSendMessage(input);
      setInput('');
      // Bug Fix: Stop the recognition if it's running when a message is sent.
      // This prevents the AI's audio response from being transcribed into the input field.
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    if (!isSpeechRecognitionSupported) {
      alert("抱歉，您的浏览器不支持语音识别功能。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      baseTextRef.current = input; // Store text before recording starts
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
       if (event.error === 'not-allowed') {
        alert("语音识别失败：请允许麦克风访问权限。");
      }
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
       // The SpeechRecognitionResultList object is not an array, so we can't use .map or .forEach
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      
      const separator = baseTextRef.current.trim().length > 0 ? ' ' : '';
      setInput(baseTextRef.current + separator + fullTranscript);
    };

    onMicStart?.();
    recognition.start();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // When the user types manually, update the input
    setInput(e.target.value);
    // And, critically, if speech recognition is in progress, stop it.
    // This prevents the STT from overwriting the user's manual edits.
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm p-1 border-t border-slate-700/50">
      <form onSubmit={handleSubmit} className="modern-input-container flex items-center gap-2 p-1">
        <textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={isEffectivelyDisabled}
          rows={1}
          className="modern-input flex-1 bg-slate-800/50 backdrop-blur-sm border-2 border-transparent focus:border-purple-500 rounded-xl p-2 text-sm text-white placeholder-slate-400 resize-none disabled:opacity-50 outline-none transition-all duration-300"
          aria-label="Chat input"
        />
        {isSpeechRecognitionSupported && (
            <button
                type="button"
                onClick={handleMicClick}
                disabled={isEffectivelyDisabled && !isRecording}
                className={`modern-btn p-3 rounded-xl transition-all duration-300 flex items-center justify-center ${
                isRecording 
                    ? 'mic-active animate-pulse' 
                    : 'mic-default'
                } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
                aria-label={isRecording ? "停止录音" : "开始录音"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            </button>
        )}
        <button
          type="submit"
          disabled={isEffectivelyDisabled || !input.trim()}
          className="modern-btn send-btn px-2 py-4 rounded-xl font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 flex items-center gap-2"
          aria-label="Send message"
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          <span className="text-sm">发送</span>
        </button>
      </form>
    </div>
  );
};
