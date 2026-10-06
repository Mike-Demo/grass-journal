# Demo Script — Grass Journal MVP (5 minutes)

*Goal: show a complete private journaling loop, then prove the privacy claim live.*

## Setup (before the demo)

1. `npm run build && npm run preview`, open in a Chromium desktop browser.
2. Storage & backup → **Load demo data** (two labeled entries, one with synthetic audio).
3. Optional: install the transcription model on fast Wi-Fi beforehand (~150 MB).
   Do NOT install the reflection model live unless you have 10 spare minutes.

## The loop (0:00–3:00)

1. **Home (0:00).** “No account, no cloud. Your thoughts stay with you.”
   Point at the status chips: entries, recordings, offline, AI readiness, last backup.
2. **Record (0:30).** Tap ● Record, speak for 5 seconds, tap ■ Stop & save.
   *“The audio committed to the device the moment I stopped. Nothing uploaded —
   there's nowhere to upload it to.”* Open the entry; play it back.
3. **Transcribe (1:30).** *“Transcription is manual and on-device.”* Tap
   Transcribe → watch progress → edit the transcript inline → note the model label.
4. **Reflect (2:15).** Tap Reflect → JSON-validated summary, tags, themes, one
   question. *“It only ever sees this entry. It's labeled AI-generated, editable,
   deletable — and it can never overwrite my words.”*
5. **Write (2:45).** Type a line; point at the save indicator: *Saving… → Saved
   on this device.*

## The proof (3:00–4:30)

6. **Privacy screen.** *“Claims are cheap — here's the receipt.”* Run the privacy
   check live: it intercepts every network transport while saving, reflecting,
   exporting, and restoring. **Zero requests.**
7. **Backup.** Export with a passphrase → show the `.grassjournal` file →
   *“AES-256, passphrase-derived. We never store it — lose it and it's gone.”*
   Preview a restore: counts and duplicates shown *before* anything is written.

## The honest close (4:30–5:00)

8. **Compact mode.** *“The feeling wheel, inside the full app — same check-in as
   the watch page, plus writing mode. Experimental; we don't claim it runs on
   every watch.”*
9. **Limitations.** Browser storage can be evicted (hence backups); no app lock
   yet; reflection needs WebGPU; Whisper tiny is demo-grade. *“We'd rather tell
   you what's unfinished than sell you what's untrue.”*

## If something fails live

- Transcription model not downloaded → show the AI Setup screen states instead.
- Mic denied → pivot to the text editor: “typed journaling is a full alternative.”
- The privacy check is deterministic — it will pass.
