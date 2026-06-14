import { useState, useEffect, useCallback, useRef } from 'react';
import { matchesWakePhrase, SPEECH_LANG_MAP } from '../i18n/voiceWakePhrases';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useVoiceSos(onTrigger: () => void, language = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef(false);
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = SPEECH_LANG_MAP[language] || 'en-IN';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }

      const lowerText = currentTranscript.toLowerCase();
      setTranscript(lowerText);

      if (matchesWakePhrase(lowerText)) {
        console.log('[Voice SOS] Wake phrase detected:', lowerText);
        recognition.stop();
        onTriggerRef.current();
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('[Voice SOS] Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
        isEnabledRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isEnabledRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.warn('[Voice SOS] Failed to auto-restart', e);
        }
      }
    };

    return recognition;
  }, [language]);

  // Re-init recognition when language changes while listening
  useEffect(() => {
    if (!recognitionRef.current) return;
    const wasEnabled = isEnabledRef.current;
    if (wasEnabled) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    recognitionRef.current = initRecognition();
    if (wasEnabled && recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { /* ignore */ }
    }
  }, [language, initRecognition]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }

    if (!recognitionRef.current) return;

    if (isEnabledRef.current) {
      isEnabledRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      isEnabledRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('[Voice SOS] Start error', e);
      }
    }
  }, [initRecognition]);

  useEffect(() => {
    return () => {
      isEnabledRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    toggleListening,
    isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}
