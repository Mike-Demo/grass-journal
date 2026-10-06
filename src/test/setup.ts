import '@testing-library/jest-dom';
// Dexie needs a real indexedDB in jsdom.
import 'fake-indexeddb/auto';
// jsdom's Blob lacks .text()/.arrayBuffer(); use Node's implementation.
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
(globalThis as unknown as { Blob: unknown }).Blob = NodeBlob;
(globalThis as unknown as { File: unknown }).File = NodeFile;
