/**
 * Demo data generator: clearly-labeled sample entries for trying the app.
 * Audio is a short synthesized tone (honest demo audio — labeled as such).
 */
import { db, saveEntryWithAudio } from '../db';
import { sha256Hex } from '../lib/backup';
import { newEntryId } from '../lib/validation';
import { SCHEMA_VERSION, type AudioRecord, type JournalEntry } from '../lib/types';

const DEMO_TAG = 'demo-data';

/** Render a 3-second gentle sine sweep as a WAV blob (demo audio only). */
async function synthDemoWav(): Promise<Blob> {
  const rate = 16000;
  const seconds = 3;
  const ctx = new OfflineAudioContext(1, rate * seconds, rate);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, 0);
  osc.frequency.exponentialRampToValueAtTime(440, seconds);
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.exponentialRampToValueAtTime(0.4, 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(seconds);
  const rendered = await ctx.startRendering();
  const pcm = rendered.getChannelData(0);

  // Minimal WAV encoder.
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  writeStr(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function seedDemoData(): Promise<void> {
  await clearDemoData();
  const now = Date.now();
  const day = 86_400_000;

  const textEntry: JournalEntry = {
    id: newEntryId(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now - 2 * day,
    updatedAt: now - 2 * day,
    entryType: 'text',
    title: '🌱 Demo: morning walk',
    bodyText:
      '🌱 DEMO ENTRY — safe to delete.\n\nWalked the long way around the pond this morning. The reeds are finally tall enough to hide the ducks. Thought about the garden beds and what to plant when the soil warms up.',
    transcriptStatus: 'none',
    tags: [DEMO_TAG],
    favorite: false,
  };

  const voiceEntryId = newEntryId();
  const audioId = newEntryId();
  const wav = await synthDemoWav();
  const buf = await wav.arrayBuffer();
  const voiceEntry: JournalEntry = {
    id: voiceEntryId,
    schemaVersion: SCHEMA_VERSION,
    createdAt: now - day,
    updatedAt: now - day,
    entryType: 'voice',
    title: '🌱 Demo: voice note (synthetic audio)',
    bodyText: '🌱 DEMO ENTRY — the audio below is a synthesized tone, not a real recording.',
    audioBlobId: audioId,
    audioMimeType: 'audio/wav',
    audioDuration: 3,
    transcriptStatus: 'not-started',
    tags: [DEMO_TAG],
    favorite: true,
  };
  const audio: AudioRecord = {
    id: audioId,
    journalEntryId: voiceEntryId,
    blob: wav,
    mimeType: 'audio/wav',
    byteLength: wav.size,
    duration: 3,
    createdAt: now - day,
    integrityHash: await sha256Hex(buf),
  };

  await saveEntryWithAudio(textEntry);
  await saveEntryWithAudio(voiceEntry, audio);
}

export async function clearDemoData(): Promise<void> {
  const ids = await db.entries.filter((e) => e.tags.includes(DEMO_TAG)).primaryKeys();
  await db.transaction('rw', db.entries, db.audio, async () => {
    for (const id of ids) {
      await db.audio.where('journalEntryId').equals(id).delete();
      await db.entries.delete(id);
    }
  });
}
