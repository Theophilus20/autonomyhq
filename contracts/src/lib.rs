//! Athanor smart contracts for the Casper Network (Odra 2.x).
#![cfg_attr(not(test), no_std)]

extern crate alloc;

pub mod treasury;

pub use treasury::{AthanorTreasury, TreasuryError};
