/**
 * Deterministic reflection fallback. Used when WebGPU / the LLM is unavailable.
 * Pure local heuristics — no model, no network — clearly labeled as such.
 */
import type { Reflection } from '../lib/types';
import { REFLECT_PROMPT_VERSION } from './prompts';

const STOPWORDS = new Set(
  'a,an,the,and,or,but,if,then,else,when,at,by,for,with,about,into,through,during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,once,here,there,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,don,should,now,i,me,my,myself,we,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,would,could,ought,as,of,today,yesterday,tomorrow'.split(','),
);

/** Extract up to 5 frequent, meaningful words as tags. Deterministic. */
export function extractTags(text: string, max = 5): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);
}

export function deterministicReflection(entryText: string): Reflection {
  const text = entryText.trim();
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0]?.slice(0, 200) ?? '';
  return {
    summary: firstSentence
      ? `Entry begins: "${firstSentence}"`
      : 'Empty entry.',
    tags: extractTags(text),
    themes: [],
    reflectionQuestion: '',
    model: 'deterministic-fallback',
    promptVersion: REFLECT_PROMPT_VERSION,
    generatedAt: Date.now(),
    userEdited: false,
  };
}
