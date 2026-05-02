# Whisper ASR Service

Local Faster Whisper service used by the API to create real transcript timestamps before PDF alignment.

## Run

```bash
cd services/whisper
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 9001
```

Defaults:

- `WHISPER_MODEL_SIZE=small`
- `WHISPER_DEVICE=auto`
- `WHISPER_COMPUTE_TYPE=int8`
- `WHISPER_MODEL_ROOT` optional local model cache directory

## API

```bash
curl -X POST http://127.0.0.1:9001/transcribe \
  -H 'content-type: application/json' \
  --data '{"audioUrl":"http://127.0.0.1:3000/static/imports/bbc-are-think-on-your-feet/bbc-are-think-on-your-feet.mp3","language":"en"}'
```

The response contains `segments[].text`, `segments[].startMs`, and `segments[].endMs`.
