"""
Athanor Swarm — the three reasoning agents.

Each agent applies real decision logic over the shared context (market vectors,
compliance feed, treasury state). The logic is deterministic and inspectable so
a judge can read exactly *why* the swarm approved or rejected a rebalance —
no opaque "the AI decided" hand-waving.

The agents are designed to plug into an LLM reasoning call (see reasoning.py)
when ANTHROPIC_API_KEY is present, and fall back to the deterministic rules
below when it is not — so the demo runs offline with zero external dependencies.
"""
from __future__ import annotations

from typing import Any

from .base import BaseAgent


from .reasoning import think


def _llm_first(role, context, rule_fn):
    """Real LLM reasoning when available; deterministic rules otherwise."""
    r = think(role, str(context.get("action", "REBALANCE")), context)
    if r.get("llm"):
        return r["vote"], "\U0001F9E0 " + r["reasoning"]
    return rule_fn()


class RiskEvaluationAgent(BaseAgent):
    """Analyses market volatility and pool health.

    Emits RISK_SCORE_UPDATED-style reasoning. Rejects rebalances that would
    push allocation into an asset while volatility is above the safety band.
    """

    role = "risk"
    VOLATILITY_CEILING = 0.45

    def evaluate(self, context: dict[str, Any]) -> tuple[str, str]:
        return _llm_first("risk", context, lambda: self._rules(context))

    def _rules(self, context: dict[str, Any]) -> tuple[str, str]:
        sigma = float(context.get("volatility", 0.0))
        depth = float(context.get("orderbook_depth", 0.0))
        if sigma > self.VOLATILITY_CEILING:
            return "REJECT", (
                f"Volatility sigma={sigma:.2f} exceeds ceiling "
                f"{self.VOLATILITY_CEILING:.2f}; rebalance unsafe."
            )
        if depth < 50_000:
            return "REJECT", (
                f"Orderbook depth ${depth:,.0f} too thin for safe execution."
            )
        return "APPROVE", (
            f"Volatility sigma={sigma:.2f} within band; depth ${depth:,.0f} healthy."
        )


class LegalComplianceAgent(BaseAgent):
    """Checks the target asset against the compliance whitelist / ZK identity."""

    role = "l&c"

    def evaluate(self, context: dict[str, Any]) -> tuple[str, str]:
        return _llm_first("l&c", context, lambda: self._rules(context))

    def _rules(self, context: dict[str, Any]) -> tuple[str, str]:
        target = context.get("target_asset", "")
        whitelist = context.get("compliance_whitelist", [])
        kyc_ok = bool(context.get("kyc_verified", False))
        if target not in whitelist:
            return "REJECT", f"Asset {target} not on compliance whitelist."
        if not kyc_ok:
            return "REJECT", "Counterparty KYC/ZK identity unverified."
        return "APPROVE", f"Asset {target} whitelisted; KYC/ZK identity verified."


class TreasuryExecutionAgent(BaseAgent):
    """Consumes risk + compliance signals, checks treasury headroom, executes.

    The treasury agent is the one that, on APPROVE, drives the CSPR.click
    signing path to broadcast the on-chain rebalance.
    """

    role = "treasury"
    MAX_SINGLE_DELTA = 0.25

    def evaluate(self, context: dict[str, Any]) -> tuple[str, str]:
        return _llm_first("treasury", context, lambda: self._rules(context))

    def _rules(self, context: dict[str, Any]) -> tuple[str, str]:
        delta = abs(float(context.get("allocation_weight_delta", 0.0)))
        headroom = float(context.get("treasury_headroom", 0.0))
        if delta > self.MAX_SINGLE_DELTA:
            return "REJECT", (
                f"Requested delta {delta:.2f} exceeds single-move cap "
                f"{self.MAX_SINGLE_DELTA:.2f}."
            )
        if headroom < delta:
            return "REJECT", (
                f"Insufficient treasury headroom ({headroom:.2f}) for delta {delta:.2f}."
            )
        return "APPROVE", (
            f"Delta {delta:.2f} within cap; treasury headroom {headroom:.2f} sufficient."
        )


def build_default_swarm() -> list[BaseAgent]:
    return [
        RiskEvaluationAgent("risk-agent-01"),
        LegalComplianceAgent("lc-agent-01"),
        TreasuryExecutionAgent("treasury-agent-01"),
    ]
