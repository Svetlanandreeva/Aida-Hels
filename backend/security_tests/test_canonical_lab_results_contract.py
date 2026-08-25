from pathlib import Path

from lab_normalization import canonical_lab_result, exact_numeric, parse_reference

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_exact_numeric_does_not_manufacture_bounded_values():
    assert exact_numeric("5.4") == 5.4
    assert exact_numeric("5,4") == 5.4
    assert exact_numeric("<0.1") is None
    assert exact_numeric(">200") is None
    assert exact_numeric("positive") is None


def test_reference_range_is_only_parsed_when_explicit():
    assert parse_reference("3.5 - 5.5") == (3.5, 5.5)
    assert parse_reference("до 5.5") == (None, None)
    assert parse_reference(None) == (None, None)


def test_canonical_result_keeps_source_and_profile_provenance():
    row = canonical_lab_result(
        report_id="report-1",
        profile_id="profile-1",
        biomarker={
            "name": "Глюкоза",
            "value": "5,4",
            "unit": "ммоль/л",
            "reference": "3,9–5,8",
            "status": "normal",
            "ocr_confidence": 0.97,
        },
        observed_at="2026-08-25",
        source_file_id="file-1",
        source_hash="abc",
        confirmed_by_account_id="account-1",
    )
    assert row["subject_profile_id"] == "profile-1"
    assert row["report_id"] == "report-1"
    assert row["value_original"] == "5,4"
    assert row["value_normalized"] == 5.4
    assert row["reference_low"] == 3.9
    assert row["reference_high"] == 5.8
    assert row["verification_status"] == "user_confirmed"
    assert row["source_file_id"] == "file-1"
    assert row["source_hash"] == "abc"


def test_lab_commit_materializes_canonical_rows_and_dedupes_source_file():
    source = read("backend/lab_pipeline.py")
    assert "hashlib.sha256(content).hexdigest()" in source
    assert 'db.labs.find_one({"profile_id": profile_id, "source_hash": source_hash})' in source
    assert "canonical_lab_result(" in source
    assert "await db.lab_results.insert_one(result_doc)" in source
    assert 'await db.lab_results.delete_many({"report_id": lab.id})' in source
    assert '@router.get("/labs/{lab_id}/results")' in source
