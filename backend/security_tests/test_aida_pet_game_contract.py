from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GAME_API = ROOT / "backend" / "game_api.py"
MAIN = ROOT / "backend" / "main.py"
PROFILE = ROOT / "backend" / "profile_api.py"
ROOT_LAYOUT = ROOT / "frontend" / "app" / "_layout.tsx"
PET_SCREEN = ROOT / "frontend" / "app" / "pet.tsx"
GAME_CLIENT = ROOT / "frontend" / "src" / "gameApi.ts"


def test_pet_game_is_wired_into_production_entrypoint():
    source = MAIN.read_text(encoding="utf-8")
    assert "from game_api import build_game_router" in source
    assert "app.include_router(build_game_router(_google_db, auth_service))" in source


def test_pet_unlock_and_rarity_are_server_authoritative():
    source = GAME_API.read_text(encoding="utf-8")
    assert 'if int(state.get("level") or 1) < 2' in source
    assert 'if state["pet"]["claimed"]' in source
    assert "_stable_roll(profile_id)" in source
    assert 'AIDA_PET_RARE_PERCENT' in source
    assert '"discount_percent": 50' in source
    assert '"requires_active_partner_offer": True' in source


def test_daily_journal_reward_is_separate_coin_ledger():
    source = GAME_API.read_text(encoding="utf-8")
    assert "DAILY_JOURNAL_REWARD = 10" in source
    assert 'tx_id = f"journal:{profile_id}:{local_day}"' in source
    assert '"kind": "daily_journal"' in source
    assert "reconcile_journal_rewards" in source
    assert "db.game_coin_ledger" in source


def test_pet_level_uses_existing_aida_gamification_level():
    source = GAME_API.read_text(encoding="utf-8")
    assert "legacy_server.gamification(profile_id)" in source
    assert 'level = int(legacy.get("level") or 1)' in source
    assert '"level": level if pet_code else None' in source


def test_care_spends_coins_server_side():
    source = GAME_API.read_text(encoding="utf-8")
    assert 'CARE_COSTS = {"feed": 5, "play": 8, "groom": 6}' in source
    assert 'if int(state.get("coins") or 0) < cost' in source
    assert '"amount": -cost' in source


def test_profile_deletion_removes_game_data():
    source = PROFILE.read_text(encoding="utf-8")
    assert "db.pet_games" in source
    assert "db.game_coin_ledger" in source
    assert "db.game_entitlements" in source


def test_frontend_auto_opens_wheel_and_explains_rewards():
    layout = ROOT_LAYOUT.read_text(encoding="utf-8")
    pet = PET_SCREEN.read_text(encoding="utf-8")
    client = GAME_CLIENT.read_text(encoding="utf-8")
    assert "function PetUnlockGate()" in layout
    assert 'router.push("/pet" as any)' in layout
    assert "game.pet.claim_available" in layout
    assert "spinPet(activeId)" in pet
    assert "2600" in pet
    assert "50%" in pet
    assert "участвующих партнёров" in pet
    assert "daily_journal_reward" in pet
    assert "careForPet" in client
