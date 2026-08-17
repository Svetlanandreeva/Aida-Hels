from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCREEN = ROOT / "frontend" / "app" / "sleep-rhythm.tsx"
REVIEW = ROOT / "frontend" / "src" / "components" / "CircadianCandidateReview.tsx"


def test_sleep_rhythm_exposes_pending_wearable_candidate_review():
    screen = SCREEN.read_text(encoding="utf-8")
    review = REVIEW.read_text(encoding="utf-8")

    assert 'CircadianCandidateReview' in screen
    assert 'profileId={activeId}' in screen
    assert 'listPendingCircadianCandidates' in review
    assert 'correctCircadianCandidate' in review
    assert 'approveCircadianCandidate' in review
    assert 'rejectCircadianCandidate' in review
    assert 'testID="wearable-circadian-review"' in review


def test_review_requires_valid_local_date_and_time_before_commit():
    review = REVIEW.read_text(encoding="utf-8")

    assert 'DATE_RE.test(item.payload.local_date)' in review
    assert 'TIME_RE.test(item.payload.local_time)' in review
    assert 'disabled={busy || !valid}' in review
    assert 'await correctCircadianCandidate(item.id' in review
    assert 'await approveCircadianCandidate(item.id)' in review
    assert 'await rejectCircadianCandidate(item.id)' in review


def test_review_preserves_existing_design_system_tokens():
    review = REVIEW.read_text(encoding="utf-8")

    assert 'from "@/src/theme"' in review
    assert 'colors.surfaceSecondary' in review
    assert 'radius.xl' in review
    assert 'spacing.lg' in review
