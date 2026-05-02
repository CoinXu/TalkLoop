export interface RecognizedSpeechSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface SpeechRecognitionProvider {
  transcribe(input: { audioUrl: string; language?: string | undefined }): Promise<RecognizedSpeechSegment[]>;
}
