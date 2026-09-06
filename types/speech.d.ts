/**
 * Minimal Web Speech API surface. The API is missing in several browsers and its
 * typings are inconsistent across TypeScript DOM lib versions, so the two vendor
 * globals are declared as optional. Everything using them must feature detect first.
 */

declare global {
  type SpeechAlternative = { readonly transcript: string };

  type SpeechResult = {
    readonly length: number;
    readonly isFinal: boolean;
    readonly [index: number]: SpeechAlternative;
  };

  type SpeechResultList = {
    readonly length: number;
    readonly [index: number]: SpeechResult;
  };

  type SpeechResultEvent = {
    readonly resultIndex: number;
    readonly results: SpeechResultList;
  };

  type WebSpeechRecognition = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechResultEvent) => void) | null;
    onerror: ((event: { readonly error: string }) => void) | null;
    onend: (() => void) | null;
  };

  type WebSpeechRecognitionConstructor = new () => WebSpeechRecognition;

  interface Window {
    webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  }

  var SpeechRecognition: WebSpeechRecognitionConstructor | undefined;
}

export {};
