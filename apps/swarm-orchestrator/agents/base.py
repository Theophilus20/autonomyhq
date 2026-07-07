"""
Athanor Swarm — Agent base class and cryptographic identity.

Each agent owns an ed25519 keypair (the same curve Casper uses for its
`ed25519` account keys). When an agent votes on a proposal it signs the
canonical proposal digest, producing a real, verifiable cryptographic proof
that lands in the SwarmProposalEvent.signatures[] array.

This is intentionally NOT mocked: signatures verify, and the treasury
contract's quorum check mirrors the same threshold logic on-chain.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any

from nacl.signing import SigningKey, VerifyKey
from nacl.encoding import HexEncoder


def canonical_digest(payload: dict[str, Any]) -> bytes:
    """Deterministic SHA-256 over the canonical JSON of a proposal payload.

    Sorting keys + compact separators guarantees every agent signs byte-for-byte
    the same message, which is what makes the signatures mutually verifiable.
    """
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(canonical).digest()


@dataclass
class AgentIdentity:
    """An agent's on-chain-style ed25519 identity."""

    agent_id: str
    _signing_key: SigningKey = field(default_factory=SigningKey.generate, repr=False)

    @property
    def public_key_hex(self) -> str:
        # Casper ed25519 public keys are prefixed with "01"; we mirror that
        # convention so the value is drop-in recognisable on cspr.live.
        raw = self._signing_key.verify_key.encode(encoder=HexEncoder).decode()
        return "01" + raw

    def sign(self, digest: bytes) -> str:
        sig = self._signing_key.sign(digest).signature
        return sig.hex()

    @staticmethod
    def verify(public_key_hex: str, digest: bytes, signature_hex: str) -> bool:
        try:
            raw_hex = public_key_hex[2:] if public_key_hex.startswith("01") else public_key_hex
            vk = VerifyKey(raw_hex, encoder=HexEncoder)
            vk.verify(digest, bytes.fromhex(signature_hex))
            return True
        except Exception:
            return False


@dataclass
class AgentVote:
    agent_id: str
    vote: str  # "APPROVE" | "REJECT"
    public_key: str
    cryptographic_proof: str
    rationale: str


class BaseAgent:
    """Base class for a reasoning agent in the swarm.

    Subclasses implement `evaluate()` which inspects the shared market/context
    state and returns (vote, rationale). The base class handles signing so that
    every subclass emits a real cryptographic proof without re-implementing it.
    """

    role: str = "base"

    def __init__(self, agent_id: str):
        self.identity = AgentIdentity(agent_id=agent_id)

    @property
    def agent_id(self) -> str:
        return self.identity.agent_id

    def evaluate(self, context: dict[str, Any]) -> tuple[str, str]:
        raise NotImplementedError

    def vote_on(self, proposal_payload: dict[str, Any], context: dict[str, Any]) -> AgentVote:
        vote, rationale = self.evaluate(context)
        digest = canonical_digest(proposal_payload)
        proof = self.identity.sign(digest)
        return AgentVote(
            agent_id=self.agent_id,
            vote=vote,
            public_key=self.identity.public_key_hex,
            cryptographic_proof=proof,
            rationale=rationale,
        )
