FROM node:20-alpine AS build

RUN apk add --no-cache git
WORKDIR /src
RUN git clone --depth 1 --branch main https://github.com/Svetlanandreeva/Aida2-0-.git aida2

WORKDIR /src/aida2/frontend
ENV EXPO_NO_TELEMETRY=1
RUN corepack enable && yarn install --frozen-lockfile
RUN npx expo export --platform web

FROM python:3.11-alpine

RUN apk add --no-cache nginx libstdc++ gcc musl-dev libffi-dev
WORKDIR /app/backend

COPY --from=build /src/aida2/backend/server.py /app/backend/server.py
COPY stand_db.py /app/backend/stand_db.py
COPY --from=build /src/aida2/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/http.d/default.conf

RUN pip install --no-cache-dir \
    fastapi==0.110.1 \
    uvicorn==0.25.0 \
    python-dotenv>=1.0.1 \
    pymongo==4.6.3 \
    motor==3.3.1 \
    pydantic>=2.6.4 \
    python-multipart>=0.0.9 \
    google-auth>=2.35.0 \
    google-api-python-client>=2.149.0

RUN python - <<'PY'
from pathlib import Path
p = Path('/app/backend/server.py')
s = p.read_text()
s = s.replace(
'from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType',
'''try:\n    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType\nexcept ImportError:\n    LlmChat = None\n    UserMessage = None\n    FileContentWithMimeType = None''')
s = s.replace(
'''MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
''',
'''MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "aida")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

if MONGO_URL:
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
else:
    from stand_db import StandClient, StandDB
    client = StandClient()
    db = StandDB()
''')
s = s.replace(
'''@app.on_event("startup")
async def _startup():
    # auto-seed on empty db
    count = await db.profiles.count_documents({})
    if count == 0:
        try:
            await seed()
        except Exception:
            logging.exception("seed on startup failed")
''',
'''@app.on_event("startup")
async def _startup():
    # Never invent medical data on the public stand.
    if os.environ.get("AIDA_SEED_DEMO") == "1":
        count = await db.profiles.count_documents({})
        if count == 0:
            try:
                await seed()
            except Exception:
                logging.exception("seed on startup failed")
''')
s = s.replace(
'if not EMERGENT_LLM_KEY:\n        raise HTTPException(500, "LLM key is not configured")',
'if not EMERGENT_LLM_KEY or LlmChat is None:\n        raise HTTPException(503, "Aida AI provider is not configured on this deployment")')
p.write_text(s)
PY

ENV AIDA_SEED_DEMO=0
EXPOSE 8080
CMD ["sh", "-c", "uvicorn server:app --host 127.0.0.1 --port 8000 & exec nginx -g 'daemon off;' "]
