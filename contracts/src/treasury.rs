//! AthanorTreasury — swarm-controlled vault for the Athanor sovereign economic network.
//!
//! This contract is the on-chain counterpart of the off-chain swarm consensus.
//! The same quorum rule the Python `ConsensusEngine` enforces (>= required
//! signatures to APPROVE) is enforced here before any rebalance executes.
//!
//! Written against Odra 2.x. Key differences from older tutorials:
//!   - `Var<T>` (not `Variable`), `Mapping<K, V>`
//!   - `use odra::prelude::*` brings Address, Mapping, Var, etc. into scope
//!   - init args are passed via a generated `*InitArgs` struct
//!   - environment access is `self.env()` (caller, revert, emit_event)
//!   - events derive `#[odra::event]` and are emitted via `self.env().emit_event(..)`

use odra::casper_types::U256;
use odra::prelude::*;

/// Errors surfaced by the treasury. Numeric codes appear on-chain on revert.
#[odra::odra_error]
pub enum TreasuryError {
    /// Caller is not a registered swarm agent.
    NotAnAgent = 1,
    /// Protocol is paused; no state-changing calls allowed.
    ProtocolPaused = 2,
    /// Fewer approvals than the required signature threshold.
    InsufficientQuorum = 3,
    /// Requested amount exceeds the tracked asset balance.
    InsufficientBalance = 4,
    /// Only the deployer/admin may call this entry point.
    Unauthorized = 5,
}

/// Emitted when a rebalance clears quorum and executes.
#[odra::event]
pub struct RebalanceExecuted {
    pub proposal_id: String,
    pub token: Address,
    pub destination: Address,
    pub amount: U256,
    pub approvals: u8,
}

/// Emitted when the protocol is paused or resumed.
#[odra::event]
pub struct OperationalStatusChanged {
    pub active: bool,
}

#[odra::module]
pub struct AthanorTreasury {
    /// Registered swarm agent addresses allowed to submit approvals.
    multi_sig_agents: Mapping<Address, bool>,
    /// Tracked per-token balances under swarm control.
    asset_balances: Mapping<Address, U256>,
    /// Number of agent approvals required for a rebalance to execute.
    required_signatures: Var<u8>,
    /// Whether the protocol is currently operational.
    operational_status: Var<bool>,
    /// Deployer / admin address for privileged ops (pause, register).
    admin: Var<Address>,
    /// Count of executed rebalances (feeds the frontend + audit trail).
    rebalance_count: Var<u64>,
}

#[odra::module]
impl AthanorTreasury {
    /// Initialise with the founding set of agents and the quorum threshold.
    pub fn init(&mut self, agents: Vec<Address>, required_sigs: u8) {
        for agent in agents.iter() {
            self.multi_sig_agents.set(agent, true);
        }
        self.required_signatures.set(required_sigs);
        self.operational_status.set(true);
        self.admin.set(self.env().caller());
        self.rebalance_count.set(0);
    }

    /// Execute a rebalance once the swarm has reached quorum off-chain.
    ///
    /// `approvals` is the count of APPROVE votes the swarm collected; the
    /// caller must be a registered agent, and approvals must meet the
    /// on-chain threshold. This double-gates execution: the swarm agrees
    /// off-chain AND the contract re-checks the threshold on-chain.
    pub fn execute_rebalance(
        &mut self,
        proposal_id: String,
        token: Address,
        destination: Address,
        amount: U256,
        approvals: u8,
    ) {
        if !self.operational_status.get_or_default() {
            self.env().revert(TreasuryError::ProtocolPaused);
        }
        let caller = self.env().caller();
        if !self.multi_sig_agents.get_or_default(&caller) {
            self.env().revert(TreasuryError::NotAnAgent);
        }
        let required = self.required_signatures.get_or_default();
        if approvals < required {
            self.env().revert(TreasuryError::InsufficientQuorum);
        }
        let balance = self.asset_balances.get_or_default(&token);
        if balance < amount {
            self.env().revert(TreasuryError::InsufficientBalance);
        }

        self.asset_balances.set(&token, balance - amount);
        let dest_balance = self.asset_balances.get_or_default(&destination);
        self.asset_balances.set(&destination, dest_balance + amount);

        self.rebalance_count.set(self.rebalance_count.get_or_default() + 1);
        self.env().emit_event(RebalanceExecuted {
            proposal_id,
            token,
            destination,
            amount,
            approvals,
        });
    }

    /// Credit a tracked balance (funding the vault for the demo).
    pub fn deposit(&mut self, token: Address, amount: U256) {
        let current = self.asset_balances.get_or_default(&token);
        self.asset_balances.set(&token, current + amount);
    }

    /// Admin-only: pause or resume the protocol (mirrors HALT_PROTOCOL action).
    pub fn set_operational(&mut self, active: bool) {
        self.assert_admin();
        self.operational_status.set(active);
        self.env().emit_event(OperationalStatusChanged { active });
    }

    /// Admin-only: register a new swarm agent.
    pub fn register_agent(&mut self, agent: Address) {
        self.assert_admin();
        self.multi_sig_agents.set(&agent, true);
    }

    // ---- views ----

    pub fn is_agent(&self, agent: Address) -> bool {
        self.multi_sig_agents.get_or_default(&agent)
    }

    pub fn balance_of(&self, token: Address) -> U256 {
        self.asset_balances.get_or_default(&token)
    }

    pub fn required_signatures(&self) -> u8 {
        self.required_signatures.get_or_default()
    }

    pub fn is_operational(&self) -> bool {
        self.operational_status.get_or_default()
    }

    pub fn rebalance_count(&self) -> u64 {
        self.rebalance_count.get_or_default()
    }

    fn assert_admin(&self) {
        if self.env().caller() != self.admin.get().unwrap() {
            self.env().revert(TreasuryError::Unauthorized);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, HostRef};

    fn setup() -> (odra::host::HostEnv, AthanorTreasuryHostRef) {
        let env = odra_test::env();
        let agents = vec![env.get_account(0), env.get_account(1), env.get_account(2)];
        let init = AthanorTreasuryInitArgs {
            agents,
            required_sigs: 3,
        };
        let contract = AthanorTreasury::deploy(&env, init);
        (env, contract)
    }

    #[test]
    fn deploys_with_agents_and_quorum() {
        let (env, contract) = setup();
        assert!(contract.is_agent(env.get_account(0)));
        assert!(contract.is_agent(env.get_account(1)));
        assert_eq!(contract.required_signatures(), 3);
        assert!(contract.is_operational());
    }

    #[test]
    fn executes_rebalance_with_quorum() {
        let (env, mut contract) = setup();
        let token = env.get_account(5);
        let dest = env.get_account(6);
        contract.deposit(token, U256::from(1_000u64));

        env.set_caller(env.get_account(0));
        contract.execute_rebalance(
            "proposal-1".to_string(),
            token,
            dest,
            U256::from(400u64),
            3, // approvals meet quorum
        );

        assert_eq!(contract.balance_of(token), U256::from(600u64));
        assert_eq!(contract.balance_of(dest), U256::from(400u64));
        assert_eq!(contract.rebalance_count(), 1);
    }

    #[test]
    fn rejects_rebalance_below_quorum() {
        let (env, mut contract) = setup();
        let token = env.get_account(5);
        let dest = env.get_account(6);
        contract.deposit(token, U256::from(1_000u64));

        env.set_caller(env.get_account(0));
        let result = contract.try_execute_rebalance(
            "proposal-2".to_string(),
            token,
            dest,
            U256::from(400u64),
            2, // below quorum of 3
        );
        assert!(result.is_err());
    }

    #[test]
    fn rejects_non_agent_caller() {
        let (env, mut contract) = setup();
        let token = env.get_account(5);
        let dest = env.get_account(6);
        contract.deposit(token, U256::from(1_000u64));

        env.set_caller(env.get_account(9)); // not registered
        let result = contract.try_execute_rebalance(
            "proposal-3".to_string(),
            token,
            dest,
            U256::from(100u64),
            3,
        );
        assert!(result.is_err());
    }

    #[test]
    fn admin_can_pause() {
        let (env, mut contract) = setup();
        env.set_caller(env.get_account(0)); // admin (deployer)
        contract.set_operational(false);
        assert!(!contract.is_operational());
    }
}
