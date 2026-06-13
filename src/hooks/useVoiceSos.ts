import { useState, useEffect, useCallback, useRef } from 'react';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useVoiceSos(onTrigger: () => void) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef(false);

  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

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

      // Check for wake words
      if (lowerText.includes('help me') || lowerText.includes('medical emergency')) {
        console.log('[Voice SOS] Wake word detected:', lowerText);
        // Stop recognition momentarily to prevent double triggers
        recognition.stop();
        onTrigger();
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
      // Auto-restart if it's still supposed to be enabled
      if (isEnabledRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.warn('[Voice SOS] Failed to auto-restart', e);
        }
      }
    };

    return recognition;
  }, [onTrigger]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      recognitionRef.current = initRecognition();
    }

    if (!recognitionRef.current) return;

    if (isEnabledRef.current) {
      // Turn off
      isEnabledRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Turn on
      isEnabledRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('[Voice SOS] Start error', e);
      }
    }
  }, [initRecognition]);

  // Cleanup on unmount
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
    isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
}
