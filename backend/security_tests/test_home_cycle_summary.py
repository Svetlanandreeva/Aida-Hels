import asyncio

from home_api import _cycle_summary


class _Cursor:
    def __init__(self, rows):
        self.rows = rows

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _limit):
        return self.rows


class _Collection:
    def __init__(self, one=None, rows=None):
        self.one = one
        self.rows = rows or []

    async def find_one(self, *_args, **_kwargs):
        return self.one

    def find(self, *_args, **_kwargs):
        return _Cursor(self.rows)


class _Db:
    def __init__(self, profile, starts):
        self.profiles = _Collection(one=profile)
        self.cycle_events = _Collection(rows=starts)


def test_cycle_summary_is_not_applicable_for_non_female_profile():
    state = asyncio.run(_cycle_summary(_Db({"id": "p1", "sex": "male"}, []), "p1", "2026-08-17"))
    assert state == {"state": "not_applicable", "cycle_day": None, "last_period_start": None}


def test_cycle_summary_has_no_fake_cycle_day_without_period_start():
    state = asyncio.run(_cycle_summary(_Db({"id": "p1", "sex": "female"}, []), "p1", "2026-08-17"))
    assert state == {"state": "no_data", "cycle_day": None, "last_period_start": None}


def test_cycle_summary_uses_confirmed_period_start_only():
    state = asyncio.run(
        _cycle_summary(
            _Db({"id": "p1", "sex": "female"}, [{"observed_at": "2026-08-14T08:00:00+05:00"}]),
            "p1",
            "2026-08-17",
        )
    )
    assert state["state"] == "data"
    assert state["cycle_day"] == 4
    assert state["last_period_start"] == "2026-08-14"
