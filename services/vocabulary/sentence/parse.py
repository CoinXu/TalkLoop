"""
Parse Tatoeba English-Chinese resources into corpus sentence JSONL rows.
"""

import argparse
import csv
import json
import re
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_RESOURCE_DIR = SCRIPT_DIR / ".resource"
DEFAULT_OUTPUT = SCRIPT_DIR / ".data" / "corpus-sentences.jsonl"
DEFAULT_MIN_CHARS = 6
DEFAULT_MAX_CHARS = 150
DEFAULT_LIMIT = None
DEV_SENTENCE_AUDIO_URL = "https://api.dictionaryapi.dev/media/pronunciations/en/who-us.mp3"

STOP_WORDS = {
    "a",
    "about",
    "all",
    "an",
    "and",
    "are",
    "aren",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "can",
    "could",
    "couldn",
    "did",
    "didn",
    "do",
    "does",
    "doesn",
    "don",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "here",
    "him",
    "his",
    "how",
    "i",
    "ll",
    "m",
    "in",
    "is",
    "it",
    "its",
    "let",
    "me",
    "my",
    "not",
    "of",
    "on",
    "one",
    "or",
    "our",
    "she",
    "should",
    "shouldn",
    "so",
    "that",
    "the",
    "there",
    "their",
    "them",
    "they",
    "this",
    "to",
    "tom",
    "very",
    "was",
    "wasn",
    "we",
    "were",
    "weren",
    "what",
    "when",
    "where",
    "who",
    "why",
    "will",
    "won",
    "with",
    "would",
    "wouldn",
    "you",
    "your",
    "mary",
}


def load_sentences(resource_dir):
    """Load English and Chinese sentence maps from Tatoeba TSV files."""

    eng = load_language_sentences(resource_dir / "eng_sentences.tsv", "eng")
    cmn = load_language_sentences(resource_dir / "cmn_sentences.tsv", "cmn")
    print(f"英文句子: {len(eng)}")
    print(f"中文句子: {len(cmn)}")
    return eng, cmn


def load_language_sentences(path, language):
    sentences = {}
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.reader(source, delimiter="\t"):
            if len(row) >= 3 and row[1] == language:
                sentences[int(row[0])] = row[2].strip()
    return sentences


def iter_tatoeba_pairs(resource_dir, min_chars=DEFAULT_MIN_CHARS, max_chars=DEFAULT_MAX_CHARS):
    """Yield filtered English-Chinese pairs from Tatoeba links.

    Tatoeba link rows are not guaranteed to put English on the left, so both
    orientations are checked.
    """

    eng, cmn = load_sentences(resource_dir)
    seen = set()
    links_path = resource_dir / "links.csv"

    with links_path.open(encoding="utf-8", newline="") as source:
        for row in csv.reader(source, delimiter="\t"):
            if len(row) < 2:
                continue
            try:
                left_id, right_id = int(row[0]), int(row[1])
            except ValueError:
                continue

            if left_id in eng and right_id in cmn:
                eng_id, cmn_id = left_id, right_id
            elif left_id in cmn and right_id in eng:
                eng_id, cmn_id = right_id, left_id
            else:
                continue

            key = (eng_id, cmn_id)
            if key in seen:
                continue
            seen.add(key)

            en_text = clean_text(eng[eng_id])
            zh_text = clean_text(cmn[cmn_id])
            if not is_usable_pair(en_text, zh_text, min_chars, max_chars):
                continue

            yield {
                "en": en_text,
                "zh": zh_text,
                "source": {
                    "provider": "tatoeba",
                    "engSentenceId": eng_id,
                    "cmnSentenceId": cmn_id,
                },
            }


def build_sentence_database(resource_dir, output, min_chars=DEFAULT_MIN_CHARS, max_chars=DEFAULT_MAX_CHARS, limit=DEFAULT_LIMIT):
    output.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    skipped_duplicate_text = 0
    seen_text = set()

    with output.open("w", encoding="utf-8", newline="\n") as target:
        for sort_order, pair in enumerate(iter_tatoeba_pairs(resource_dir, min_chars, max_chars), start=1):
            text_key = normalize_sentence_key(pair["en"], pair["zh"])
            if text_key in seen_text:
                skipped_duplicate_text += 1
                continue
            seen_text.add(text_key)

            row = build_sentence_row(pair, sort_order)
            target.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
            written += 1
            if limit is not None and written >= limit:
                break

    return {
        "output": str(output),
        "skippedDuplicateText": skipped_duplicate_text,
        "written": written,
    }


def build_sentence_row(pair, sort_order):
    sentence_text = pair["en"]
    tokens = tokenize(sentence_text)
    target_words = pick_target_words(tokens, 3)
    bonus_words = [word for word in pick_target_words(tokens, 8) if word not in target_words][:5]

    return {
        "schemaVersion": 1,
        "sentenceKey": f"tatoeba:{pair['source']['engSentenceId']}:{pair['source']['cmnSentenceId']}",
        "corpusSentencePatch": {
            "audioStatus": "ready",
            "bonusWords": bonus_words,
            "courseId": None,
            "difficultyLevel": difficulty_level(tokens),
            "normalAudioUrl": DEV_SENTENCE_AUDIO_URL,
            "phraseChunks": phrase_chunks(sentence_text),
            "publishStatus": "published",
            "reviewStatus": "approved",
            "sceneId": None,
            "sceneTags": ["tatoeba", "bilingual"],
            "sentenceText": sentence_text,
            "slowAudioUrl": DEV_SENTENCE_AUDIO_URL,
            "sortOrder": sort_order,
            "targetWords": target_words,
            "translationCn": pair["zh"],
        },
        "source": pair["source"],
    }


def match_examples(pairs, words, max_per_word=5):
    """Match bilingual examples for words using an inverted sentence index."""

    index = {}
    for idx, pair in enumerate(pairs):
        for token in set(tokenize(pair["en"])):
            index.setdefault(token, []).append(idx)

    result = {}
    for word in words:
        normalized = word.lower()
        if normalized not in index:
            continue

        examples = []
        seen = set()
        for idx in index[normalized]:
            en = pairs[idx]["en"]
            zh = pairs[idx]["zh"]
            key = en[:30]
            if key in seen:
                continue
            seen.add(key)
            examples.append({"en": en, "zh": zh})
            if len(examples) >= max_per_word:
                break
        result[word] = examples

    return result


def is_usable_pair(en_text, zh_text, min_chars, max_chars):
    if not zh_text:
        return False
    if len(en_text) < min_chars or len(en_text) > max_chars:
        return False
    tokens = tokenize(en_text)
    if len(tokens) < 2 or len(tokens) > 24:
        return False
    return True


def clean_text(value):
    return re.sub(r"\s+", " ", value).strip()


def normalize_sentence_key(en_text, zh_text):
    return (en_text.casefold(), zh_text)


def tokenize(sentence):
    return re.findall(r"[a-z]+", sentence.lower())


def pick_target_words(tokens, limit):
    selected = []
    seen = set()
    for token in tokens:
        lemma = token.strip("'")
        if len(lemma) <= 2 or lemma in STOP_WORDS or lemma in seen:
            continue
        seen.add(lemma)
        selected.append(lemma)
        if len(selected) >= limit:
            break
    return selected


def phrase_chunks(sentence, max_words=12):
    chunks = []
    for part in re.split(r"([,;:.!?])", sentence):
        text = part.strip()
        if not text or re.fullmatch(r"[,;:.!?]", text):
            if chunks and text:
                chunks[-1] = f"{chunks[-1]}{text}"
            continue
        chunks.extend(split_long_chunk(text, max_words))
    return chunks or [sentence]


def split_long_chunk(text, max_words):
    words = text.split()
    if len(words) <= max_words:
        return [text]
    return [" ".join(words[index : index + max_words]) for index in range(0, len(words), max_words)]


def difficulty_level(tokens):
    count = len(tokens)
    if count <= 6:
        return 1
    if count <= 12:
        return 2
    if count <= 18:
        return 3
    return 4


def parse_args():
    parser = argparse.ArgumentParser(description="Build corpus sentence JSONL from Tatoeba English-Chinese resources.")
    parser.add_argument("--resource-dir", type=Path, default=DEFAULT_RESOURCE_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--min-chars", type=int, default=DEFAULT_MIN_CHARS)
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS)
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    return parser.parse_args()


def main():
    args = parse_args()
    result = build_sentence_database(
        resource_dir=args.resource_dir.resolve(),
        output=args.output.resolve(),
        min_chars=args.min_chars,
        max_chars=args.max_chars,
        limit=args.limit,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
