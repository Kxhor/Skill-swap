import os
import re
import json
from datetime import datetime, timezone, timedelta
from app.extensions import db
from app.models.match_score import MatchScore
from app.models.user import User
from app.models.user_skill import UserSkill


def compute_match(user_a_id: str, user_b_id: str) -> dict:
    existing = MatchScore.query.filter(
        ((MatchScore.user_a_id == user_a_id) & (MatchScore.user_b_id == user_b_id))
        | ((MatchScore.user_a_id == user_b_id) & (MatchScore.user_b_id == user_a_id))
    ).first()

    if existing and existing.computed_at.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc) - timedelta(days=7):
        return {"score": existing.score, "reason": existing.reason, "cached": True}

    user_a = User.query.get(user_a_id)
    user_b = User.query.get(user_b_id)
    if not user_a or not user_b:
        return {"score": 0, "reason": "User not found", "cached": False}

    a_offered = UserSkill.query.filter_by(user_id=user_a_id, type="offered").all()
    a_wanted = UserSkill.query.filter_by(user_id=user_a_id, type="wanted").all()
    b_offered = UserSkill.query.filter_by(user_id=user_b_id, type="offered").all()
    b_wanted = UserSkill.query.filter_by(user_id=user_b_id, type="wanted").all()

    if not a_offered and not a_wanted and not b_offered and not b_wanted:
        return {"score": 0, "reason": "Not enough skill data", "cached": False}

    score, reason = _call_gemini(user_a.name, [s.skill.name for s in a_offered], [s.skill.name for s in a_wanted],
                                 user_b.name, [s.skill.name for s in b_offered], [s.skill.name for s in b_wanted])

    if existing:
        existing.score = score
        existing.reason = reason
        existing.computed_at = datetime.now(timezone.utc)
    else:
        m = MatchScore(user_a_id=user_a_id, user_b_id=user_b_id, score=score, reason=reason)
        db.session.add(m)
    db.session.commit()

    return {"score": score, "reason": reason, "cached": False}


def _call_gemini(name_a: str, offered_a: list[str], wanted_a: list[str],
                 name_b: str, offered_b: list[str], wanted_b: list[str]) -> tuple[int, str]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return 50, "AI matching unavailable (no API key)"

    prompt = _build_prompt(name_a, offered_a, wanted_a, name_b, offered_b, wanted_b)

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
        resp = model.generate_content(prompt)
        text = resp.text.strip()
        return _parse_response(text)
    except Exception as e:
        return 50, f"AI matching error: {str(e)}"


def _build_prompt(name_a, offered_a, wanted_a, name_b, offered_b, wanted_b):
    return f"""You are a skill-matching assistant for a peer-to-peer learning platform.
Given two users, their offered skills, and their wanted skills, rate how well they would match for a skill swap on a scale of 0 to 100.

{name_a} offers: {', '.join(offered_a) if offered_a else 'nothing yet'}
{name_a} wants to learn: {', '.join(wanted_a) if wanted_a else 'nothing yet'}

{name_b} offers: {', '.join(offered_b) if offered_b else 'nothing yet'}
{name_b} wants to learn: {', '.join(wanted_b) if wanted_b else 'nothing yet'}

A good match means {name_a} offers something {name_b} wants AND {name_b} offers something {name_a} wants (reciprocal match).
A fair match means one side can teach what the other wants (one-directional match).
A poor match means no skills align.

Respond with ONLY a JSON object on a single line:
{{"score": <0-100 integer>, "reason": "<one-sentence explanation>"}}"""


def _parse_response(text: str) -> tuple[int, str]:
    try:
        obj = json.loads(text)
        score = max(0, min(100, int(obj.get("score", 0))))
        reason = obj.get("reason", "AI-matched score")
        return score, reason
    except (json.JSONDecodeError, ValueError, TypeError):
        match = re.search(r'"score"\s*:\s*(\d+)', text)
        if match:
            score = max(0, min(100, int(match.group(1))))
            reason_match = re.search(r'"reason"\s*:\s*"([^"]+)"', text)
            reason = reason_match.group(1) if reason_match else "AI-matched score"
            return score, reason
        return 50, "AI-matched score (parse fallback)"
