"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function recognitionConstructor(): WebSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return globalThis.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export type SpeechInput = {
  isListening: boolean;
  /** Returns false when the browser has no Web Speech API, e.g. Firefox or older Safari. */
  toggle: () => boolean;
};

/**
 * Hebrew dictation, progressive enhancement only. The recognizer is created on first
 * use rather than on mount, so support is detected at the moment of the tap and the
 * button renders identically on the server and the client.
 */
export function useSpeechInput(onResult: (transcript: string) => void): SpeechInput {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);

  // Kept in a ref so the recognizer's handler always calls the latest callback
  // without needing to be torn down and rebuilt on every render.
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const toggle = useCallback((): boolean => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return true;
    }

    if (!recognitionRef.current) {
      const Constructor = recognitionConstructor();
      if (!Constructor) return false;

      const recognition = new Constructor();
      recognition.lang = "he-IL";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex]?.[0]?.transcript;
        if (transcript) onResultRef.current(transcript.trim());
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
      return true;
    } catch {
      setIsListening(false);
      return true;
    }
  }, [isListening]);

  return { isListening, toggle };
}
