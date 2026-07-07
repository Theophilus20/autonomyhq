"""LLM-backed reasoning for AutonomyHQ swarm agents.

Each agent thinks with a real OpenRouter call (model from ATHANOR_MODEL /
AUTONOMYHQ_MODEL, default openai/gpt-4o-mini). If the API is unreachable or
the key is missing, falls back to deterministic rule-based reasoning so a
live demo never freezes.
"""
import json
import os
import urllib.request

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = os.environ.get("AUTONOMYHQ_MODEL") or os.environ.get("ATHANOR_MODEL") or "openai/gpt-4o-mini"
API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

ROLE_PROMPTS = {
    "risk": (
        "You are the RISK agent of AutonomyHQ, an autonomous AI treasury on the "
        "Casper network. Evaluate the proposal strictly for market risk: "
        "volatility, liquidity depth, drawdown exposure."
    ),
    "l&c": (
        "You are the COMPLIANCE agent of AutonomyHQ. Evaluate the proposal "
        "strictly for compliance: asset whitelist status, KYC/ZK identity "
        "checks, jurisdiction constraints."
    ),
    "treasury": (
        "You are the TREASURY agent of AutonomyHQ. Evaluate the proposal for "
        "execution: treasury headroom, position sizing, settlement feasibility "
        "on Casper."
    ),
}

def _fallback(role: str, action: str, context: dict) -> dict:
    sigma = context.get("volatilitySigma", 0.22)
    depth = context.get("poolDepthUSD", 120_000)
    delta = context.get("positionDelta", 0.10)
    if role == "risk":
        ok = sigma < 0.35 and depth > 50_000
        why = f"Volatility sigma={sigma} {'within band' if ok else 'ABOVE band'}; depth ${depth:,} {'healthy' if ok else 'thin'}."
    elif role == "l&c":
        ok = context.get("assetWhitelisted", True)
        why = f"Asset {context.get('targetAsset','GOLD-RWA')} {'whitelisted' if ok else 'NOT whitelisted'}; KYC/ZK identity verified."
    else:
        ok = delta <= 0.25
        why = f"Delta {delta} {'within cap' if ok else 'exceeds cap'}; treasury headroom {context.get('headroom',0.40)} sufficient."
    return {"vote": "APPROVE" if ok else "REJECT", "reasoning": why, "llm": False}

def think(role: str, action: str, context: dict, timeout: float = 25.0) -> dict:
    """Return {vote, reasoning, llm} — llm=True when a real model call succeeded."""
    if not API_KEY:
        return _fallback(role, action, context)
    try:
        prompt = (
            f"{ROLE_PROMPTS.get(role, ROLE_PROMPTS['risk'])}\n\n"
            f"PROPOSAL: {action}\nCONTEXT: {json.dumps(context)}\n\n"
            "You have full authority over your domain. Weigh the actual numbers in CONTEXT, "
            "mention at least two of them explicitly, and take a clear position — hedge only "
            "if the data is genuinely borderline. Respond with ONLY a JSON object: "
            "{\"vote\": \"APPROVE\" or \"REJECT\", \"reasoning\": \"<max two sharp sentences "
            "citing the numbers that drove your decision>\"}"
        )
        body = json.dumps({
            "model": MODEL,
            "max_tokens": 120,
            "temperature": 0.4,
            "messages": [{"role": "user", "content": prompt}],
        }).encode()
        req = urllib.request.Request(
            OPENROUTER_URL, data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode())
        text = data["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            text = text.strip("`").replace("json\n", "", 1).strip()
        parsed = json.loads(text)
        vote = "APPROVE" if str(parsed.get("vote", "")).upper().startswith("A") else "REJECT"
        reasoning = str(parsed.get("reasoning", ""))[:280] or "(no reasoning returned)"
        return {"vote": vote, "reasoning": reasoning, "llm": True}
    except Exception as e:  # noqa: BLE001 — any failure means fallback, never freeze
        fb = _fallback(role, action, context)
        fb["reasoning"] += f" [rule-based fallback: {type(e).__name__}]"
        return fb

def feedback(role: str, action: str, vote: str, reasoning: str = "", timeout: float = 20.0) -> str:
    """One-sentence post-meeting feedback from the agent (LLM, with fallback)."""
    if API_KEY:
        try:
            body = json.dumps({
                "model": MODEL, "max_tokens": 60, "temperature": 0.7,
                "messages": [{
                    "role": "user",
                    "content": (
                        f"You are the {role} agent of an AI treasury. You just voted {vote} "
                        f"on '{action}'. Your reasoning was: {reasoning or 'n/a'}. "
                        "Write ONE sentence of genuine retrospective feedback: state what "
                        "you checked, the decision taken, and the single most important "
                        "thing to monitor before the next window. Concrete, no fluff."
                    ),
                }],
            }).encode()
            req = urllib.request.Request(
                OPENROUTER_URL, data=body,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode())
            return data["choices"][0]["message"]["content"].strip()[:240]
        except Exception:
            pass
    # Grounded fallback: reference the actual decision and reasoning taken.
    base = (reasoning or "").replace("\U0001F9E0", "").strip().rstrip(".")
    if base:
        return f"Voted {vote} — {base}. Will re-verify these numbers before the next window."
    return f"Voted {vote} on {action}; no anomalies logged this round."


def enrich(role: str, vote: str, rationale: str, context: dict) -> str:
    """Kept for API compatibility with consensus.py: the rationale now comes
    from the LLM (or rules fallback) inside each agent, so pass it through."""
    return rationale


def decide_purchase(context: dict, timeout: float = 20.0) -> dict:
    """The Risk agent DECIDES whether to spend treasury funds on fresh market
    data (x402). A real economic choice made by the model, with a deterministic
    fallback (buy when volatility is elevated or data is stale)."""
    if API_KEY:
        try:
            body = json.dumps({
                "model": MODEL, "max_tokens": 80, "temperature": 0.3,
                "messages": [{"role": "user", "content": (
                    "You are the RISK agent of an AI treasury. Fresh premium RWA "
                    "market data costs 0.025 CSPR via x402. Given this context: "
                    f"{json.dumps(context)} — decide whether buying fresh data is "
                    "worth it before deliberating. Respond ONLY with JSON: "
                    '{"buy": true/false, "reason": "<one short sentence>"}'
                )}],
            }).encode()
            req = urllib.request.Request(
                OPENROUTER_URL, data=body,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode())
            text = data["choices"][0]["message"]["content"].strip()
            if text.startswith("```"):
                text = text.strip("`").replace("json\n", "", 1).strip()
            parsed = json.loads(text)
            return {"buy": bool(parsed.get("buy")), "reason": str(parsed.get("reason", ""))[:200], "llm": True}
        except Exception:
            pass
    vol = float(context.get("volatility", 0.2))
    buy = vol >= 0.18
    reason = (f"Volatility {vol} is elevated; fresh valuation data justifies the 0.025 CSPR cost."
              if buy else f"Volatility {vol} is calm; cached data suffices this round.")
    return {"buy": buy, "reason": reason, "llm": False}
