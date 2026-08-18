from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_body_links_to_biological_age_explanation_screen():
    source = (ROOT / "frontend" / "app" / "body.tsx").read_text(encoding="utf-8")
    assert 'router.push("/biological-age" as any)' in source
    assert 'testID="open-biological-age"' in source
    assert "Что нужно добавить?" in source
    assert "Почему так?" in source


def test_biological_age_screen_is_fail_closed_and_explainable():
    source = (ROOT / "frontend" / "app" / "biological-age.tsx").read_text(encoding="utf-8")
    assert "validated_model_not_enabled" in source
    assert "Недостаточно данных" in source
    assert "Что повлияло на оценку" in source
    assert "Что нужно добавить" in source
    assert 'router.push("/(tabs)/health" as any)' in source
