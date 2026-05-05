UPDATE word_meta
SET derived_fields = derived_fields - 'meaningEn' - 'partOfSpeech',
    updated_at = now()
WHERE derived_fields ? 'meaningEn'
   OR derived_fields ? 'partOfSpeech';
