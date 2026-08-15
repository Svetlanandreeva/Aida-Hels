from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import uuid
import tempfile
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Aida Health API")
api = APIRouter(prefix="/api")

GEMINI_MODEL = "gemini-3-flash-preview"


# ============ Models ============

class Profile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    kind: str  # "me" | "child" | "relative"
    dob: Optional[str] = None  # ISO date
    sex: Optional[str] = None  # "female" | "male"
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileCreate(BaseModel):
    name: str
    kind: str
    dob: Optional[str] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    sex: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    blood_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None


class Biomarker(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None
    reference: Optional[str] = None
    status: Optional[str] = None  # "normal" | "high" | "low" | "unknown"


class LabTest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    title: str
    date: str  # ISO date
    lab_name: Optional[str] = None
    biomarkers: List[Biomarker] = []
    ai_summary: Optional[str] = None
    source: Optional[str] = None  # "manual" | "upload"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LabTestCreate(BaseModel):
    profile_id: str
    title: str
    date: str
    lab_name: Optional[str] = None
    biomarkers: List[Biomarker] = []
    source: Optional[str] = "manual"


class Symptom(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    name: str
    severity: int = 5  # 1-10
    note: Optional[str] = None
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SymptomCreate(BaseModel):
    profile_id: str
    name: str
    severity: int = 5
    note: Optional[str] = None
    date: Optional[str] = None


class Medication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    name: str
    dose: Optional[str] = None
    schedule: Optional[str] = None  # e.g. "1 tab, 2x/day"
    active: bool = True
    start_date: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicationCreate(BaseModel):
    profile_id: str
    name: str
    dose: Optional[str] = None
    schedule: Optional[str] = None
    active: bool = True
    start_date: Optional[str] = None
    notes: Optional[str] = None


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    role: str  # "user" | "assistant"
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    profile_id: str
    text: str


class Widget(BaseModel):
    id: str
    enabled: bool = True
    order: int = 0


class PuzzleConfig(BaseModel):
    profile_id: str
    widgets: List[Widget] = []


# ============ Helpers ============

def clean(doc):
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def get_profile_context(profile_id: str) -> str:
    prof = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not prof:
        return ""
    meds = await db.medications.find({"profile_id": profile_id, "active": True}, {"_id": 0}).to_list(50)
    recent_sym = await db.symptoms.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(10)
    recent_labs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(5)
    recent_vitals = await db.vitals.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(10)
    recent_checkins = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(7)

    ctx = {
        "profile": {
            "name": prof.get("name"),
            "kind": prof.get("kind"),
            "dob": prof.get("dob"),
            "sex": prof.get("sex"),
            "allergies": prof.get("allergies", []),
            "chronic_conditions": prof.get("chronic_conditions", []),
        },
        "active_medications": meds,
        "recent_symptoms": recent_sym,
        "recent_labs": [
            {"title": l["title"], "date": l["date"], "biomarkers": l.get("biomarkers", [])[:10]}
            for l in recent_labs
        ],
        "recent_vitals": recent_vitals,
        "recent_checkins": recent_checkins,
    }
    return json.dumps(ctx, ensure_ascii=False, default=str)


AIDA_SYSTEM_PROMPT = """Ты — Аида, персональный AI-помощник по здоровью. Отвечай кратко, тепло, по-человечески.

ВАЖНЫЕ ПРАВИЛА:
- Ты НЕ врач и НЕ ставишь диагнозы. Ты помогаешь понять данные и подготовиться к визиту.
- Отвечай на языке пользователя (RU или EN).
- Опирайся только на предоставленные данные. Если данных мало — так и скажи.
- Не выдумывай нормы, референсы, значения или дозировки.
- Если ситуация может быть опасной — мягко порекомендуй обратиться к врачу или в скорую.
- Различай: фактическое значение, изменение от baseline, наблюдение, рекомендация обратиться.
- Отвечай 3-6 предложениями, если пользователь не просит подробнее.
"""


# ============ Profile endpoints ============

@api.get("/")
async def root():
    return {"app": "Aida", "status": "ok"}


@api.get("/profiles", response_model=List[Profile])
async def list_profiles():
    docs = await db.profiles.find({}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return docs


@api.post("/profiles", response_model=Profile)
async def create_profile(data: ProfileCreate):
    p = Profile(**data.model_dump())
    await db.profiles.insert_one(p.model_dump())
    return p


@api.get("/profiles/{profile_id}", response_model=Profile)
async def get_profile(profile_id: str):
    doc = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Profile not found")
    return doc


@api.put("/profiles/{profile_id}", response_model=Profile)
async def update_profile(profile_id: str, data: ProfileUpdate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.profiles.update_one({"id": profile_id}, {"$set": update})
    doc = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Profile not found")
    return doc


@api.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    await db.profiles.delete_one({"id": profile_id})
    await db.labs.delete_many({"profile_id": profile_id})
    await db.symptoms.delete_many({"profile_id": profile_id})
    await db.medications.delete_many({"profile_id": profile_id})
    await db.chat_messages.delete_many({"profile_id": profile_id})
    return {"ok": True}


# ============ Lab endpoints ============

@api.get("/labs", response_model=List[LabTest])
async def list_labs(profile_id: str):
    docs = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(200)
    return docs


@api.post("/labs", response_model=LabTest)
async def create_lab(data: LabTestCreate):
    lab = LabTest(**data.model_dump())
    await db.labs.insert_one(lab.model_dump())
    return lab


@api.delete("/labs/{lab_id}")
async def delete_lab(lab_id: str):
    await db.labs.delete_one({"id": lab_id})
    return {"ok": True}


@api.post("/labs/upload")
async def upload_lab(
    profile_id: str = Form(...),
    language: str = Form("ru"),
    file: UploadFile = File(...),
):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key is not configured")

    suffix = Path(file.filename or "upload.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    mime = file.content_type or ("application/pdf" if suffix == ".pdf" else "image/jpeg")

    schema_hint = (
        'Верни строго JSON:\n'
        '{\n'
        '  "title": "название анализа (напр. Общий анализ крови)",\n'
        '  "date": "YYYY-MM-DD",\n'
        '  "lab_name": "название лаборатории или null",\n'
        '  "biomarkers": [{"name": "...", "value": "...", "unit": "...", "reference": "...", "status": "normal|high|low|unknown"}],\n'
        '  "ai_summary": "1-3 предложения на языке пользователя, что видно на анализе (без диагноза)"\n'
        '}\n'
        f'Язык ответа: {"русский" if language.startswith("ru") else "английский"}. Если поле неизвестно — null.'
    )

    system_msg = (
        "Ты — медицинский OCR-парсер. Извлекаешь показатели из фото/PDF лабораторных анализов. "
        "Возвращаешь ТОЛЬКО валидный JSON, без пояснений и без markdown-обёртки."
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"lab-ocr-{uuid.uuid4()}",
            system_message=system_msg,
        ).with_model("gemini", GEMINI_MODEL)

        file_attach = FileContentWithMimeType(file_path=tmp_path, mime_type=mime)
        resp = await chat.send_message(
            UserMessage(text=schema_hint, file_contents=[file_attach])
        )
    except Exception as e:
        logging.exception("OCR failed")
        os.unlink(tmp_path)
        raise HTTPException(500, f"OCR failed: {e}")

    os.unlink(tmp_path)

    raw = resp if isinstance(resp, str) else str(resp)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except Exception:
        # Try to extract JSON object
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(raw[start : end + 1])
            except Exception:
                parsed = {
                    "title": "Анализ",
                    "date": datetime.now(timezone.utc).date().isoformat(),
                    "biomarkers": [],
                    "ai_summary": raw[:500],
                }
        else:
            parsed = {
                "title": "Анализ",
                "date": datetime.now(timezone.utc).date().isoformat(),
                "biomarkers": [],
                "ai_summary": raw[:500],
            }

    biomarkers = []
    for b in parsed.get("biomarkers") or []:
        try:
            biomarkers.append(
                Biomarker(
                    name=str(b.get("name", "")),
                    value=str(b.get("value", "")),
                    unit=b.get("unit"),
                    reference=b.get("reference"),
                    status=b.get("status") or "unknown",
                )
            )
        except Exception:
            continue

    lab = LabTest(
        profile_id=profile_id,
        title=parsed.get("title") or "Анализ",
        date=parsed.get("date") or datetime.now(timezone.utc).date().isoformat(),
        lab_name=parsed.get("lab_name"),
        biomarkers=biomarkers,
        ai_summary=parsed.get("ai_summary"),
        source="upload",
    )
    await db.labs.insert_one(lab.model_dump())
    return lab


# ============ Symptom endpoints ============

@api.get("/symptoms", response_model=List[Symptom])
async def list_symptoms(profile_id: str):
    docs = await db.symptoms.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(200)
    return docs


@api.post("/symptoms", response_model=Symptom)
async def create_symptom(data: SymptomCreate):
    d = data.model_dump()
    if not d.get("date"):
        d["date"] = datetime.now(timezone.utc).date().isoformat()
    s = Symptom(**d)
    await db.symptoms.insert_one(s.model_dump())
    return s


@api.delete("/symptoms/{symptom_id}")
async def delete_symptom(symptom_id: str):
    await db.symptoms.delete_one({"id": symptom_id})
    return {"ok": True}


# ============ Medication endpoints ============

@api.get("/medications", response_model=List[Medication])
async def list_medications(profile_id: str):
    docs = await db.medications.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api.post("/medications", response_model=Medication)
async def create_medication(data: MedicationCreate):
    m = Medication(**data.model_dump())
    await db.medications.insert_one(m.model_dump())
    return m


@api.put("/medications/{med_id}", response_model=Medication)
async def update_medication(med_id: str, data: MedicationCreate):
    upd = data.model_dump()
    upd.pop("profile_id", None)
    await db.medications.update_one({"id": med_id}, {"$set": upd})
    doc = await db.medications.find_one({"id": med_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api.delete("/medications/{med_id}")
async def delete_medication(med_id: str):
    await db.medications.delete_one({"id": med_id})
    return {"ok": True}


# ============ Chat endpoints ============

@api.get("/chat", response_model=List[ChatMessage])
async def list_chat(profile_id: str):
    docs = await db.chat_messages.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs


@api.post("/chat")
async def chat(req: ChatRequest, language: str = "ru"):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key is not configured")

    user_msg = ChatMessage(profile_id=req.profile_id, role="user", text=req.text)
    await db.chat_messages.insert_one(user_msg.model_dump())

    ctx = await get_profile_context(req.profile_id)
    lang_hint = "Отвечай на русском." if language.startswith("ru") else "Reply in English."
    system = AIDA_SYSTEM_PROMPT + f"\n\n{lang_hint}\n\nКонтекст пользователя (JSON):\n{ctx}"

    # Include a short history
    history = await db.chat_messages.find({"profile_id": req.profile_id}, {"_id": 0}).sort("created_at", -1).to_list(10)
    history.reverse()
    history_text = "\n".join([f"{m['role'].upper()}: {m['text']}" for m in history[:-1]])

    prompt = req.text
    if history_text:
        prompt = f"История:\n{history_text}\n\nТекущий вопрос: {req.text}"

    try:
        chat_client = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"aida-{req.profile_id}",
            system_message=system,
        ).with_model("gemini", GEMINI_MODEL)
        resp = await chat_client.send_message(UserMessage(text=prompt))
        answer = resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        logging.exception("Chat failed")
        raise HTTPException(500, f"Chat failed: {e}")

    ai_msg = ChatMessage(profile_id=req.profile_id, role="assistant", text=answer.strip())
    await db.chat_messages.insert_one(ai_msg.model_dump())
    return {"user": user_msg.model_dump(), "assistant": ai_msg.model_dump()}


@api.delete("/chat")
async def clear_chat(profile_id: str):
    await db.chat_messages.delete_many({"profile_id": profile_id})
    return {"ok": True}


# ============ Doctor report ============

@api.get("/report/{profile_id}")
async def doctor_report(profile_id: str, days: int = 90, language: str = "ru"):
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")

    since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()

    labs = await db.labs.find({"profile_id": profile_id, "date": {"$gte": since}}, {"_id": 0}).sort("date", -1).to_list(100)
    symptoms = await db.symptoms.find({"profile_id": profile_id, "date": {"$gte": since}}, {"_id": 0}).sort("date", -1).to_list(200)
    meds = await db.medications.find({"profile_id": profile_id}, {"_id": 0}).to_list(100)

    # AI summary (best-effort)
    ai_summary = None
    if EMERGENT_LLM_KEY:
        try:
            ctx = {
                "profile": {k: profile.get(k) for k in ("name", "dob", "sex", "allergies", "chronic_conditions")},
                "labs": [{"title": l["title"], "date": l["date"], "biomarkers": l.get("biomarkers", [])[:15]} for l in labs[:5]],
                "symptoms": symptoms[:20],
                "medications": meds,
                "period_days": days,
            }
            lang = "русском" if language.startswith("ru") else "английском"
            system = (
                "Ты помогаешь пациенту подготовиться к визиту врача. Составь краткую нейтральную сводку "
                f"на {lang} языке: 4-8 пунктов, только на основе данных. Раздели: 'Наблюдения', 'Что стоит уточнить у врача'. "
                "Никаких диагнозов и назначений."
            )
            c = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"report-{profile_id}",
                system_message=system,
            ).with_model("gemini", GEMINI_MODEL)
            resp = await c.send_message(UserMessage(text=json.dumps(ctx, ensure_ascii=False, default=str)))
            ai_summary = resp if isinstance(resp, str) else str(resp)
        except Exception:
            logging.exception("Report AI summary failed")
            ai_summary = None

    return {
        "profile": profile,
        "period_days": days,
        "since": since,
        "labs": labs,
        "symptoms": symptoms,
        "medications": meds,
        "ai_summary": ai_summary,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============ Analytics readiness ============

@api.get("/analytics/readiness/{profile_id}")
async def readiness(profile_id: str):
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")

    scores = {}
    # Profile completeness
    profile_fields = ["dob", "sex", "height_cm", "weight_kg", "blood_type", "allergies", "chronic_conditions"]
    filled = sum(1 for f in profile_fields if profile.get(f) not in (None, "", []))
    scores["profile"] = int(round(filled / len(profile_fields) * 100))

    labs_count = await db.labs.count_documents({"profile_id": profile_id})
    scores["labs"] = min(100, labs_count * 25)

    sym_count = await db.symptoms.count_documents({"profile_id": profile_id})
    scores["symptoms"] = min(100, sym_count * 15)

    meds_count = await db.medications.count_documents({"profile_id": profile_id})
    scores["medications"] = min(100, meds_count * 30)

    overall = int(sum(scores.values()) / len(scores))
    return {"scores": scores, "overall": overall}


# ============ Gamification ============

@api.get("/gamification/{profile_id}")
async def gamification(profile_id: str):
    labs = await db.labs.count_documents({"profile_id": profile_id})
    sym = await db.symptoms.count_documents({"profile_id": profile_id})
    meds = await db.medications.count_documents({"profile_id": profile_id})
    msgs = await db.chat_messages.count_documents({"profile_id": profile_id, "role": "user"})
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0}) or {}

    profile_fields = ["dob", "sex", "height_cm", "weight_kg", "blood_type", "allergies", "chronic_conditions"]
    profile_filled = sum(1 for f in profile_fields if profile.get(f) not in (None, "", []))

    xp = labs * 40 + sym * 8 + meds * 20 + msgs * 5 + profile_filled * 15
    level = 1
    threshold = 100
    remaining_xp = xp
    while remaining_xp >= threshold and level < 50:
        remaining_xp -= threshold
        level += 1
        threshold = int(threshold * 1.4)
    xp_to_next = threshold - remaining_xp

    quests = [
        {"id": "add-profile", "title": "Заполнить профиль", "title_en": "Complete profile", "done": profile_filled >= 5, "xp": 60},
        {"id": "first-lab", "title": "Загрузить первый анализ", "title_en": "Upload first lab test", "done": labs >= 1, "xp": 40},
        {"id": "log-symptom", "title": "Записать симптом", "title_en": "Log a symptom", "done": sym >= 1, "xp": 15},
        {"id": "add-med", "title": "Добавить лекарство", "title_en": "Add a medication", "done": meds >= 1, "xp": 20},
        {"id": "chat-aida", "title": "Спросить Аиду", "title_en": "Ask Aida", "done": msgs >= 1, "xp": 10},
    ]

    mood = "sleepy" if level < 2 else ("happy" if xp >= 200 else "calm")

    return {
        "xp": xp,
        "level": level,
        "xp_in_level": remaining_xp,
        "xp_to_next": xp_to_next,
        "next_threshold": threshold,
        "companion": {"name": "Аида", "mood": mood},
        "quests": quests,
    }


# ============ Puzzle config ============

DEFAULT_WIDGETS = [
    {"id": "companion", "enabled": True, "order": 0},
    {"id": "readiness", "enabled": True, "order": 1},
    {"id": "next_medication", "enabled": True, "order": 2},
    {"id": "recent_symptom", "enabled": True, "order": 3},
    {"id": "latest_lab", "enabled": True, "order": 4},
    {"id": "quests", "enabled": True, "order": 5},
    {"id": "quick_note", "enabled": False, "order": 6},
]


@api.get("/puzzle/{profile_id}")
async def get_puzzle(profile_id: str):
    doc = await db.puzzle.find_one({"profile_id": profile_id}, {"_id": 0})
    if not doc:
        return {"profile_id": profile_id, "widgets": DEFAULT_WIDGETS}
    return doc


@api.post("/puzzle/{profile_id}")
async def save_puzzle(profile_id: str, config: PuzzleConfig):
    data = config.model_dump()
    data["profile_id"] = profile_id
    await db.puzzle.update_one({"profile_id": profile_id}, {"$set": data}, upsert=True)
    doc = await db.puzzle.find_one({"profile_id": profile_id}, {"_id": 0})
    return doc


# ============ Seed ============

@api.post("/seed")
async def seed():
    existing = await db.profiles.count_documents({})
    if existing > 0:
        docs = await db.profiles.find({}, {"_id": 0}).to_list(10)
        return {"seeded": False, "profiles": docs}

    me = Profile(
        name="Мой профиль",
        kind="me",
        dob="1992-05-14",
        sex="female",
        height_cm=168,
        weight_kg=61,
        blood_type="O+",
        allergies=["Пенициллин"],
        chronic_conditions=[],
    )
    child = Profile(
        name="Мия",
        kind="child",
        dob="2019-03-02",
        sex="female",
        height_cm=112,
        weight_kg=19.4,
        allergies=[],
        chronic_conditions=[],
    )
    relative = Profile(
        name="Мама",
        kind="relative",
        dob="1962-11-08",
        sex="female",
        height_cm=160,
        weight_kg=68,
        blood_type="A+",
        allergies=[],
        chronic_conditions=["Гипертония"],
    )

    for p in (me, child, relative):
        await db.profiles.insert_one(p.model_dump())

    # Seed some medications
    await db.medications.insert_one(Medication(
        profile_id=me.id, name="Витамин D3", dose="2000 МЕ", schedule="1 капсула утром", active=True,
        start_date="2025-01-10"
    ).model_dump())
    await db.medications.insert_one(Medication(
        profile_id=relative.id, name="Амлодипин", dose="5 мг", schedule="1 таб вечером", active=True,
        start_date="2024-06-01"
    ).model_dump())

    # Seed symptoms
    today = datetime.now(timezone.utc).date()
    for i, (n, s) in enumerate([("Головная боль", 6), ("Усталость", 4), ("Бессонница", 5)]):
        await db.symptoms.insert_one(Symptom(
            profile_id=me.id, name=n, severity=s,
            date=(today - timedelta(days=i * 3)).isoformat(),
            note=None,
        ).model_dump())

    # Seed one lab
    await db.labs.insert_one(LabTest(
        profile_id=me.id,
        title="Общий анализ крови",
        date=(today - timedelta(days=14)).isoformat(),
        lab_name="Invitro",
        biomarkers=[
            Biomarker(name="Гемоглобин", value="128", unit="г/л", reference="120–150", status="normal"),
            Biomarker(name="Эритроциты", value="4.2", unit="10¹²/л", reference="3.9–4.7", status="normal"),
            Biomarker(name="Лейкоциты", value="9.8", unit="10⁹/л", reference="4.0–9.0", status="high"),
            Biomarker(name="СОЭ", value="18", unit="мм/ч", reference="2–15", status="high"),
            Biomarker(name="Тромбоциты", value="240", unit="10⁹/л", reference="180–320", status="normal"),
        ],
        ai_summary="Показатели в целом в норме. Немного повышены лейкоциты и СОЭ — возможный признак недавнего воспаления. Стоит обсудить с врачом при жалобах.",
        source="manual",
    ).model_dump())

    # Seed blood pressure + weight
    for i, (sys, dia, pul) in enumerate([(122, 78, 70), (135, 85, 74), (128, 82, 72), (141, 91, 78)]):
        await db.vitals.insert_one(Vital(
            profile_id=me.id, kind="bp", systolic=sys, diastolic=dia, pulse=pul,
            date=(datetime.now(timezone.utc) - timedelta(days=i * 2)).isoformat(),
        ).model_dump())
    await db.vitals.insert_one(Vital(
        profile_id=me.id, kind="weight", value=61, unit="кг",
        date=(today - timedelta(days=1)).isoformat(),
    ).model_dump())

    # Seed check-ins
    for i, (m, e, s) in enumerate([(4, 3, 2), (3, 3, 3), (4, 4, 2)]):
        await db.checkins.insert_one(Checkin(
            profile_id=me.id, mood=m, energy=e, stress=s, anxiety=2, sleep=3,
            date=(datetime.now(timezone.utc) - timedelta(days=i)).isoformat(),
        ).model_dump())

    # Seed tasks
    await db.tasks.insert_one(Task(
        profile_id=me.id, title="Принять Витамин D3", kind="medication",
        due=today.isoformat(), done=False,
    ).model_dump())
    await db.tasks.insert_one(Task(
        profile_id=me.id, title="Измерить давление", kind="pressure",
        due=today.isoformat(), done=False,
    ).model_dump())
    await db.tasks.insert_one(Task(
        profile_id=me.id, title="Заполнить дневник самочувствия", kind="diary",
        due=today.isoformat(), done=True,
    ).model_dump())

    docs = await db.profiles.find({}, {"_id": 0}).to_list(10)
    return {"seeded": True, "profiles": docs}


# ============ Vitals (measurements & blood pressure) ============

class Vital(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    kind: str  # "bp" | "weight" | "temperature" | "pulse" | "spo2" | "waist"
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    pulse: Optional[float] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    note: Optional[str] = None
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VitalCreate(BaseModel):
    profile_id: str
    kind: str
    systolic: Optional[float] = None
    diastolic: Optional[float] = None
    pulse: Optional[float] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    note: Optional[str] = None
    date: Optional[str] = None


@api.get("/vitals", response_model=List[Vital])
async def list_vitals(profile_id: str, kind: Optional[str] = None):
    q: Dict[str, Any] = {"profile_id": profile_id}
    if kind:
        q["kind"] = kind
    docs = await db.vitals.find(q, {"_id": 0}).sort("date", -1).to_list(500)
    return docs


@api.post("/vitals", response_model=Vital)
async def create_vital(data: VitalCreate):
    d = data.model_dump()
    if not d.get("date"):
        d["date"] = datetime.now(timezone.utc).isoformat()
    v = Vital(**d)
    await db.vitals.insert_one(v.model_dump())
    return v


@api.delete("/vitals/{vital_id}")
async def delete_vital(vital_id: str):
    await db.vitals.delete_one({"id": vital_id})
    return {"ok": True}


# ============ Check-ins (mental / wellbeing) ============

class Checkin(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    mood: int = 3       # 1-5
    energy: int = 3     # 1-5
    stress: int = 3     # 1-5
    anxiety: int = 3    # 1-5
    sleep: int = 3      # 1-5
    triggers: Optional[str] = None
    note: Optional[str] = None
    date: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CheckinCreate(BaseModel):
    profile_id: str
    mood: int = 3
    energy: int = 3
    stress: int = 3
    anxiety: int = 3
    sleep: int = 3
    triggers: Optional[str] = None
    note: Optional[str] = None
    date: Optional[str] = None


@api.get("/checkins", response_model=List[Checkin])
async def list_checkins(profile_id: str):
    docs = await db.checkins.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(400)
    return docs


@api.post("/checkins", response_model=Checkin)
async def create_checkin(data: CheckinCreate):
    d = data.model_dump()
    if not d.get("date"):
        d["date"] = datetime.now(timezone.utc).isoformat()
    c = Checkin(**d)
    await db.checkins.insert_one(c.model_dump())
    return c


@api.delete("/checkins/{checkin_id}")
async def delete_checkin(checkin_id: str):
    await db.checkins.delete_one({"id": checkin_id})
    return {"ok": True}


# ============ Tasks ============

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    profile_id: str
    title: str
    kind: str = "custom"  # medication|pressure|lab|upload|diary|visit|custom
    due: Optional[str] = None  # ISO datetime/date
    done: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TaskCreate(BaseModel):
    profile_id: str
    title: str
    kind: str = "custom"
    due: Optional[str] = None


@api.get("/tasks", response_model=List[Task])
async def list_tasks(profile_id: str):
    docs = await db.tasks.find({"profile_id": profile_id}, {"_id": 0}).sort("created_at", -1).to_list(400)
    return docs


@api.post("/tasks", response_model=Task)
async def create_task(data: TaskCreate):
    task = Task(**data.model_dump())
    await db.tasks.insert_one(task.model_dump())
    return task


@api.put("/tasks/{task_id}/toggle", response_model=Task)
async def toggle_task(task_id: str):
    doc = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    await db.tasks.update_one({"id": task_id}, {"$set": {"done": not doc.get("done", False)}})
    doc["done"] = not doc.get("done", False)
    return doc


@api.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}


# ============ Daily overview / attention ============

@api.get("/overview/{profile_id}")
async def overview(profile_id: str, language: str = "ru"):
    profile = await db.profiles.find_one({"id": profile_id}, {"_id": 0})
    if not profile:
        raise HTTPException(404, "Profile not found")

    ru = language.startswith("ru")
    since7 = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()

    attention: List[Dict[str, Any]] = []

    # out-of-range biomarkers from latest lab
    last_lab = await db.labs.find({"profile_id": profile_id}, {"_id": 0}).sort("date", -1).to_list(1)
    if last_lab:
        abn = [b for b in last_lab[0].get("biomarkers", []) if b.get("status") in ("high", "low")]
        for b in abn[:4]:
            arrow = "↑" if b.get("status") == "high" else "↓"
            attention.append({
                "type": "lab",
                "severity": "warning",
                "title": f"{b.get('name')} {arrow} {b.get('value')} {b.get('unit') or ''}".strip(),
                "subtitle": (f"Норма: {b.get('reference')}" if ru else f"Ref: {b.get('reference')}") if b.get("reference") else "",
            })

    # blood pressure
    last_bp = await db.vitals.find({"profile_id": profile_id, "kind": "bp"}, {"_id": 0}).sort("date", -1).to_list(1)
    if last_bp:
        s = last_bp[0].get("systolic") or 0
        d = last_bp[0].get("diastolic") or 0
        if s >= 140 or d >= 90:
            attention.append({
                "type": "bp",
                "severity": "error",
                "title": (f"Повышенное давление {int(s)}/{int(d)}" if ru else f"High blood pressure {int(s)}/{int(d)}"),
                "subtitle": (last_bp[0].get("date") or "")[:10],
            })

    # strong symptoms last 7 days
    strong = await db.symptoms.find(
        {"profile_id": profile_id, "date": {"$gte": since7}, "severity": {"$gte": 7}}, {"_id": 0}
    ).sort("date", -1).to_list(5)
    for s in strong:
        attention.append({
            "type": "symptom",
            "severity": "warning",
            "title": (f"Выраженный симптом: {s['name']}" if ru else f"Strong symptom: {s['name']}"),
            "subtitle": f"{s['severity']}/10 · {s['date']}",
        })

    # AI summary of the day (best-effort)
    ai_summary = None
    if EMERGENT_LLM_KEY:
        try:
            ctx = await get_profile_context(profile_id)
            lang_word = "русском" if ru else "английском"
            system = (
                "Ты — Аида. Дай очень короткий тёплый итог дня по данным пользователя на "
                f"{lang_word} языке: 1-2 предложения. Без диагнозов. Если данных мало — мягко предложи добавить."
            )
            c = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"overview-{profile_id}",
                system_message=system,
            ).with_model("gemini", GEMINI_MODEL)
            resp = await c.send_message(UserMessage(text=f"Данные пользователя: {ctx}"))
            ai_summary = (resp if isinstance(resp, str) else str(resp)).strip()
        except Exception:
            logging.exception("overview AI failed")
            ai_summary = None

    return {"attention": attention, "ai_summary": ai_summary}


# ============ App wiring ============

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
async def _startup():
    # auto-seed on empty db
    count = await db.profiles.count_documents({})
    if count == 0:
        try:
            await seed()
        except Exception:
            logging.exception("seed on startup failed")


@app.on_event("shutdown")
async def _shutdown():
    client.close()
