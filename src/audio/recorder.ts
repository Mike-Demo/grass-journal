/**
 * Voice capture. Principle: the recording is committed to IndexedDB the moment
 * recording stops — before any transcription, reflection, or navigation.
 */
import { saveEntryWithAudio } from '../db';
import { sha256Hex } from '../lib/backup';
import { pickAudioMimeType } from '../lib/capability';
import { newEntryId } from '../lib/validation';
import type { AudioRecord, JournalEntry } from '../lib/types';
import { SCHEMA_VERSION } from '../lib/types';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopping' | 'saving' | 'error';

export interface RecordingResult {
  entry: JournalEntry;
  audio: AudioRecord;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  onStateChange: (s: RecorderState, detail?: string) => void = () => {};
  onTick: (elapsedMs: number) => void = () => {};
  private tickTimer: number | null = null;

  private setState(s: RecorderState, detail?: string) {
    this.onStateChange(s, detail);
  }

  async start(): Promise<void> {
    if (this.mediaRecorder) return;
    this.setState('requesting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.setState('error', 'Microphone access was denied or is unavailable.');
      throw err;
    }
    const { mimeType } = pickAudioMimeType();
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.startedAt = Date.now();
    this.mediaRecorder.start(1000); // 1s timeslices: an interrupted recording still has chunks
    this.setState('recording');
    this.tickTimer = window.setInterval(() => this.onTick(Date.now() - this.startedAt), 250);
  }

  /** Stop and immediately persist. Resolves only after the data is safe. */
  async stopAndSave(title?: string): Promise<RecordingResult> {
    const rec = this.mediaRecorder;
    if (!rec) throw new Error('No active recording.');
    this.setState('stopping');
    const stopped = new Promise<void>((resolve, reject) => {
      rec.onstop = () => resolve();
      rec.onerror = () => reject(new Error('Recording failed to stop cleanly.'));
    });
    rec.stop();
    await stopped;
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    this.tickTimer = null;

    this.setState('saving');
    try {
      const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
      const duration = Math.round(((Date.now() - this.startedAt) / 1000) * 10) / 10;
      const buf = await blob.arrayBuffer();
      const integrityHash = await sha256Hex(buf);
      const now = Date.now();
      const entryId = newEntryId();
      const audioId = newEntryId();
      const entry: JournalEntry = {
        id: entryId,
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
        entryType: 'voice',
        title: title?.trim() || undefined,
        bodyText: '',
        audioBlobId: audioId,
        audioMimeType: blob.type,
        audioDuration: duration,
        transcriptStatus: 'not-started',
        tags: [],
        favorite: false,
      };
      const audio: AudioRecord = {
        id: audioId,
        journalEntryId: entryId,
        blob,
        mimeType: blob.type,
        byteLength: blob.size,
        duration,
        createdAt: now,
        integrityHash,
      };
      // Single transaction: entry and audio commit together or not at all.
      await saveEntryWithAudio(entry, audio);
      return { entry, audio };
    } finally {
      this.cleanup();
      this.setState('idle');
    }
  }

  /** Discard without saving. Requires explicit user confirmation in the UI. */
  discard(): void {
    this.cleanup();
    this.setState('idle');
  }

  private cleanup() {
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

/** Decode any recorded blob to 16kHz mono Float32 for the transcription model. */
export async function decodeTo16kMono(blob: Blob): Promise<Float32Array> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio is not available on this device.');
  const ctx = new AudioCtx();
  try {
    const buf = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf);
    const targetRate = 16000;
    const offline = new OfflineAudioContext(1, Math.ceil((decoded.duration * targetRate) / 1) || 1, targetRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    void ctx.close();
  }
}
