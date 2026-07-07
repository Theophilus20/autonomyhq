"""
Proof harness: runs a full swarm deliberation on two scenarios and
independently verifies every ed25519 signature. If this prints ALL CHECKS
PASSED, the agentic + cryptographic layer is genuinely working.

Run: python3 prove_swarm.py
"""
import json

from agents.swarm_agents import build_default_swarm
from agents.consensus import ConsensusEngine


def scenario(name, context, expect_quorum):
    print(f"\n=== SCENARIO: {name} ===")
    engine = ConsensusEngine(build_default_swarm(), required_signatures=3)
    events = []
    result = engine.run("REBALANCE", context, on_event=events.append)

    for e in events:
        if e["type"] == "AGENT_VOTE":
            print(f"  [{e['role']:>8}] {e['vote']:<7} — {e['reasoning']}")
        elif e["type"] == "QUORUM_RESULT":
            print(f"  quorum: {e['approvals']}/{e['required']} -> "
                  f"{'MET' if e['quorumMet'] else 'NOT MET'}")

    sigs_ok = ConsensusEngine.verify_event(result)
    print(f"  signatures verify independently: {sigs_ok}")
    print(f"  quorumMet == expected({expect_quorum}): {result['quorumMet'] == expect_quorum}")

    assert sigs_ok, "SIGNATURE VERIFICATION FAILED"
    assert result["quorumMet"] == expect_quorum, "QUORUM OUTCOME MISMATCH"
    return result


def main():
    healthy = {
        "target_asset": "GOLD-RWA",
        "allocation_weight_delta": 0.10,
        "volatility": 0.22,
        "orderbook_depth": 120_000,
        "compliance_whitelist": ["GOLD-RWA", "REALESTATE-RWA"],
        "kyc_verified": True,
        "treasury_headroom": 0.40,
        "execution_path": ["risk", "l&c", "treasury", "casper-testnet"],
    }
    volatile = {
        **healthy,
        "target_asset": "GOLD-RWA",
        "volatility": 0.61,  # above ceiling -> risk agent rejects
    }

    approved = scenario("healthy market -> APPROVE", healthy, expect_quorum=True)
    scenario("volatility spike -> REJECT", volatile, expect_quorum=False)

    print("\n--- SAMPLE SwarmProposalEvent (approved) ---")
    printable = {**approved}
    # Truncate proofs for readable output
    printable["signatures"] = [
        {**s, "cryptographicProof": s["cryptographicProof"][:24] + "...",
         "publicKey": s["publicKey"][:20] + "..."}
        for s in approved["signatures"]
    ]
    print(json.dumps(printable, indent=2))

    print("\n\033[92mALL CHECKS PASSED\033[0m")


if __name__ == "__main__":
    main()
