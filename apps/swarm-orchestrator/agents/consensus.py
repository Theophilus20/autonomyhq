"""
Athanor Swarm — consensus engine.

Runs every agent against a proposal, collects real ed25519-signed votes, applies
the quorum rule, and assembles a SwarmProposalEvent that validates against
shared/schemas/swarm_proposal_event.json.

The quorum threshold here mirrors `required_signatures` in the on-chain
AthanorTreasury contract: the same governance rule enforced in two places.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Callable, Optional

from .base import BaseAgent, AgentIdentity, canonical_digest
from .reasoning import enrich


class ConsensusEngine:
    def __init__(self, agents: list[BaseAgent], required_signatures: int = 3):
        self.agents = agents
        self.required_signatures = required_signatures

    def run(
        self,
        action: str,
        context: dict[str, Any],
        on_event: Optional[Callable[[dict], None]] = None,
    ) -> dict[str, Any]:
        """Execute a full swarm deliberation and return a SwarmProposalEvent dict."""
        proposal_id = str(uuid.uuid4())
        payload = {
            "targetAsset": context.get("target_asset", "UNKNOWN"),
            "allocationWeightDelta": float(context.get("allocation_weight_delta", 0.0)),
            "executionPath": context.get("execution_path", ["treasury", "casper-testnet"]),
        }

        def emit(kind: str, **data):
            evt = {"type": kind, "proposalId": proposal_id, "ts": time.time(), **data}
            if on_event:
                on_event(evt)

        emit("PROPOSAL_OPENED", action=action, payload=payload)

        signatures = []
        approvals = 0
        for agent in self.agents:
            emit(
                "AGENT_THINKING",
                agentId=getattr(agent.identity, "agent_id", None) or getattr(agent, "agent_id", "agent"),
                role=getattr(agent, "role", "agent"),
            )
            vote = agent.vote_on(payload, context)
            reasoning = enrich(getattr(agent, "role", "agent"), vote.vote, vote.rationale, context)
            emit(
                "AGENT_VOTE",
                agentId=vote.agent_id,
                role=getattr(agent, "role", "agent"),
                vote=vote.vote,
                reasoning=reasoning,
            )
            if vote.vote == "APPROVE":
                approvals += 1
            signatures.append(
                {
                    "agentId": vote.agent_id,
                    "role": getattr(agent, "role", "agent"),
                    "vote": vote.vote,
                    "reasoning": reasoning,
                    "cryptographicProof": vote.cryptographic_proof,
                    "publicKey": vote.public_key,
                }
            )

        quorum_met = approvals >= self.required_signatures
        emit(
            "QUORUM_RESULT",
            approvals=approvals,
            required=self.required_signatures,
            quorumMet=quorum_met,
        )

        event = {
            "proposalId": proposal_id,
            "timestamp": int(time.time()),
            "action": action,
            "payload": payload,
            "signatures": signatures,
            "quorumMet": quorum_met,
        }
        return event

    @staticmethod
    def verify_event(event: dict[str, Any]) -> bool:
        """Independently verify every signature in a produced event.

        Proves the proofs are real: recompute the digest, check each ed25519 sig
        against the agent's published public key.
        """
        digest = canonical_digest(event["payload"])
        for sig in event["signatures"]:
            pk = sig.get("publicKey")
            proof = sig.get("cryptographicProof")
            if not pk or not proof:
                return False
            if not AgentIdentity.verify(pk, digest, proof):
                return False
        return True
