// Speech Recognition Types and Helpers

export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export class SubtitleVoiceTranscriber {
  private recognition: any = null;
  private isListening: boolean = false;
  private onResultCallback?: (text: string, isFinal: boolean) => void;
  private onErrorCallback?: (error: string) => void;
  private onEndCallback?: () => void;
  private onStartCallback?: () => void;

  constructor(langCode: string = "he-IL") {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = langCode;

        this.recognition.onstart = () => {
          this.isListening = true;
          if (this.onStartCallback) this.onStartCallback();
        };

        this.recognition.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const combined = finalTranscript || interimTranscript;
          if (this.onResultCallback && combined) {
            this.onResultCallback(combined, Boolean(finalTranscript));
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          this.isListening = false;
          let message = "שגיאה בהקלטה קולית";
          if (event.error === "not-allowed") {
            message = "נדרשת הרשאת מיקרופון. אנא אשר גישה למיקרופון בדפדפן.";
          } else if (event.error === "no-speech") {
            message = "לא זוהה דיבור.";
          } else if (event.error === "network") {
            message = "שגיאת רשת בשירות הזיהוי הקולי.";
          }
          if (this.onErrorCallback) this.onErrorCallback(message);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.onEndCallback) this.onEndCallback();
        };
      }
    }
  }

  public setLanguage(langCode: string) {
    if (this.recognition) {
      // Map standard short language codes to full BCP-47 locale tags
      const localeMap: Record<string, string> = {
        he: "he-IL",
        en: "en-US",
        ar: "ar-SA",
        ru: "ru-RU",
        es: "es-ES",
        fr: "fr-FR",
        de: "de-DE",
        it: "it-IT",
        pt: "pt-BR",
        uk: "uk-UA",
      };
      this.recognition.lang = localeMap[langCode] || langCode;
    }
  }

  public start(callbacks: {
    onStart?: () => void;
    onResult: (text: string, isFinal: boolean) => void;
    onError?: (err: string) => void;
    onEnd?: () => void;
  }) {
    if (!this.recognition) {
      if (callbacks.onError) {
        callbacks.onError("הדפדפן אינו תומך בזיהוי קולי (Web Speech API). מומלץ להשתמש ב-Chrome.");
      }
      return;
    }

    this.onStartCallback = callbacks.onStart;
    this.onResultCallback = callbacks.onResult;
    this.onErrorCallback = callbacks.onError;
    this.onEndCallback = callbacks.onEnd;

    try {
      this.recognition.start();
    } catch (err: any) {
      console.warn("Start error:", err);
    }
  }

  public stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn("Stop error:", err);
      }
    }
    this.isListening = false;
  }

  public getActive(): boolean {
    return this.isListening;
  }
}
