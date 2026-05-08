import fs from "node:fs/promises";

const consonants = ["B", "CH", "D", "DH", "F", "G", "HH", "JH", "K", "L", "M", "N", "NG", "P", "R", "S", "SH", "T", "TH", "V", "W", "Y", "Z", "ZH"];
const vowelBases = ["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"];
const vowelsStressed = vowelBases.flatMap((base) => ["0", "1", "2"].map((stress) => `${base}${stress}`));
const phonemeList = [...consonants, ...vowelsStressed];
const phonemeToIndex = new Map(phonemeList.map((phoneme, index) => [phoneme, index]));
const confusion = new Map<string, number>();

function key(left: string, right: string): string {
  return `${left}:${right}`;
}

function addConfusion(left: string, right: string, cost: number): void {
  confusion.set(key(left, right), cost);
  confusion.set(key(right, left), cost);
}

function addVowelConfusion(left: string, right: string, cost: number): void {
  for (const stress of ["0", "1", "2"]) addConfusion(`${left}${stress}`, `${right}${stress}`, cost);
}

function addStressConfusion(base: string, costLight: number, costMedium: number): void {
  addConfusion(`${base}0`, `${base}1`, costLight);
  addConfusion(`${base}0`, `${base}2`, costMedium);
  addConfusion(`${base}1`, `${base}2`, costMedium);
}

addConfusion("TH", "F", 0.2);
addConfusion("TH", "S", 0.3);
addConfusion("TH", "T", 0.4);
addConfusion("DH", "D", 0.3);
addConfusion("DH", "V", 0.4);
addConfusion("L", "R", 0.1);
addConfusion("V", "W", 0.2);
addConfusion("B", "P", 0.4);
addConfusion("D", "T", 0.4);
addConfusion("G", "K", 0.4);
addConfusion("N", "NG", 0.3);
addConfusion("S", "Z", 0.3);
addConfusion("SH", "ZH", 0.3);
addConfusion("SH", "S", 0.3);
addConfusion("CH", "JH", 0.4);
addVowelConfusion("IH", "IY", 0.3);
addVowelConfusion("EH", "AE", 0.3);
addVowelConfusion("UH", "UW", 0.3);
addVowelConfusion("AH", "EH", 0.4);
addVowelConfusion("AH", "IH", 0.4);
addVowelConfusion("ER", "AH", 0.4);
addVowelConfusion("EY", "EH", 0.3);
addVowelConfusion("AY", "IH", 0.4);
addVowelConfusion("OW", "AO", 0.3);
addVowelConfusion("AW", "AO", 0.3);
for (const vowel of vowelBases) addStressConfusion(vowel, 0.3, 0.5);

export interface HearingTrapCandidate {
  phonemes: string[];
  vectorDistance: number;
  weightedDistance: number;
  word: string;
}

export interface HearingTrapSimilarResult {
  candidates: HearingTrapCandidate[];
  phonemes: string[];
  word: string;
}

interface PreparedHearingTrapCandidate {
  phonemes: string[];
  vector: number[];
  word: string;
}

export class HearingTrapAlgorithm {
  readonly algorithmVersion = "cmudict-vector-v1";
  private readonly dictionaryPromise: Promise<Map<string, string[]>>;

  constructor(cmuDictPath: string) {
    this.dictionaryPromise = parseCmuDict(cmuDictPath);
  }

  async findSimilar(input: { candidateWords: string[]; limit: number; word: string }): Promise<HearingTrapSimilarResult> {
    const dictionary = await this.dictionaryPromise;
    const preparedCandidates = prepareCandidates(dictionary, input.candidateWords);
    const result = findSimilarFromPrepared(dictionary, preparedCandidates, input.word, input.limit);
    if (!result) throw new Error(`cmudict_missing:${normalizeWord(input.word)}`);
    return result;
  }

  async findSimilarMany(input: { candidateWords: string[]; limit: number; words: string[] }): Promise<{ missingWords: string[]; results: HearingTrapSimilarResult[] }> {
    const dictionary = await this.dictionaryPromise;
    const preparedCandidates = prepareCandidates(dictionary, input.candidateWords);
    const missingWords: string[] = [];
    const results: HearingTrapSimilarResult[] = [];
    for (const word of input.words) {
      const result = findSimilarFromPrepared(dictionary, preparedCandidates, word, input.limit);
      if (result) {
        results.push(result);
      } else {
        missingWords.push(word);
      }
    }
    return { missingWords, results };
  }
}

function prepareCandidates(dictionary: Map<string, string[]>, candidateWords: string[]): PreparedHearingTrapCandidate[] {
  const seen = new Set<string>();
  return candidateWords.flatMap((candidateWord): PreparedHearingTrapCandidate[] => {
    const normalizedWord = normalizeWord(candidateWord);
    if (!normalizedWord || seen.has(normalizedWord)) return [];
    seen.add(normalizedWord);
    const phonemes = dictionary.get(normalizedWord);
    if (!phonemes) return [];
    return [{
      phonemes,
      vector: phonemesToVector(phonemes),
      word: normalizedWord,
    }];
  });
}

function findSimilarFromPrepared(
  dictionary: Map<string, string[]>,
  preparedCandidates: PreparedHearingTrapCandidate[],
  inputWord: string,
  limit: number,
): HearingTrapSimilarResult | undefined {
  const word = normalizeWord(inputWord);
  const phonemes = dictionary.get(word);
  if (!phonemes) return undefined;
  const targetVector = phonemesToVector(phonemes);
  const coarseLimit = Math.max(limit * 8, limit);
  const candidates = preparedCandidates
      .filter((candidateWord) => candidateWord.word !== word)
      .map((candidateWord) => ({
        candidateWord,
        vectorDistance: euclideanDistance(targetVector, candidateWord.vector),
      }))
      .sort((left, right) => left.vectorDistance - right.vectorDistance || left.candidateWord.word.localeCompare(right.candidateWord.word))
      .slice(0, coarseLimit)
      .map(({ candidateWord, vectorDistance }): HearingTrapCandidate => ({
        phonemes: candidateWord.phonemes,
        vectorDistance,
        weightedDistance: weightedPhonemeDistance(phonemes, candidateWord.phonemes),
        word: candidateWord.word.toLowerCase(),
      }))
      .sort((left, right) => left.weightedDistance - right.weightedDistance || left.vectorDistance - right.vectorDistance || left.word.localeCompare(right.word))
      .slice(0, limit);
  return { candidates, phonemes, word: word.toLowerCase() };
}

async function parseCmuDict(filepath: string): Promise<Map<string, string[]>> {
  const content = await fs.readFile(filepath, "utf8");
  const dictionary = new Map<string, string[]>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";;;")) continue;
    const parts = line.split(/\s{2,}/);
    if (parts.length !== 2) continue;
    const rawWord = parts[0] ?? "";
    const cleanWord = rawWord.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (!cleanWord || dictionary.has(cleanWord)) continue;
    dictionary.set(cleanWord, (parts[1] ?? "").trim().split(/\s+/).filter(Boolean));
  }
  return dictionary;
}

function normalizeWord(word: string): string {
  return word.replace(/[^A-Za-z]/g, "").toUpperCase();
}

function phonemesToVector(phonemes: string[]): number[] {
  const vector = Array.from({ length: phonemeList.length }, () => 0);
  phonemes.forEach((phoneme, index) => {
    const phonemeIndex = phonemeToIndex.get(phoneme);
    if (phonemeIndex === undefined) return;
    vector[phonemeIndex] = (vector[phonemeIndex] ?? 0) + 1 / (1 + index * 0.3);
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
}

function euclideanDistance(left: number[], right: number[]): number {
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - (right[index] ?? 0)) ** 2, 0));
}

function confusionCost(left: string, right: string): number {
  if (left === right) return 0;
  return confusion.get(key(left, right)) ?? 1;
}

export function weightedPhonemeDistance(left: string[], right: string[]): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (let row = 0; row < rows; row += 1) dp[row]![0] = row;
  for (let col = 0; col < cols; col += 1) dp[0]![col] = col;
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      dp[row]![col] = Math.min(
        dp[row - 1]![col]! + 1,
        dp[row]![col - 1]! + 1,
        dp[row - 1]![col - 1]! + confusionCost(left[row - 1]!, right[col - 1]!),
      );
    }
  }
  return Math.round((dp[left.length]![right.length]! / Math.max(left.length, right.length, 1)) * 10000) / 10000;
}
