use anyhow::Result;
use std::process::{Command, Stdio};

use crate::{errors::DevToolError, utils::is_initialized};

pub fn instance() -> Result<()> {
    if !is_initialized() {
        return Err(DevToolError::NotInitialized.into());
    }

    let address = Command::new("solana")
        .arg("address")
        .arg("-k")
        .arg("./dev-tools/serum-dex-dev.json")
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .output()
        .expect("Must get address");

    if !address.status.success() {
        println!("There was a problem running solana address: {:?}.", address);
        std::process::exit(address.status.code().unwrap_or(1));
    }

    Ok(())
}
