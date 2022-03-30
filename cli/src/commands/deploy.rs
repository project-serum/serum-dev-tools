use std::{
    path::Path,
    process::{Command, Stdio},
};

use anchor_client::Cluster;
use anyhow::Result;

use crate::{
    config::{with_config, ConfigOverride},
    errors::DevToolError,
    utils::is_initilized,
};

pub fn deploy(cfg_override: &ConfigOverride, cluster: Option<Cluster>) -> Result<()> {
    with_config(cfg_override, |cfg| {
        if !is_initilized() {
            return Err(DevToolError::NotInitialized.into());
        }

        let cluster = cluster.unwrap();
        let cluster_url = cluster.url();

        let provider_keypair = cfg.provider.wallet.to_string();

        let program_keypair_path = Path::new("./dev-tools/serum-dex-dev.json");
        let program_artifact_path = Path::new("./dev-tools/serum-dex.so");

        let exit = Command::new("solana")
            .arg("program")
            .arg("deploy")
            .arg("--url")
            .arg(cluster_url)
            .arg("--keypair")
            .arg(provider_keypair)
            .arg("--program-id")
            .arg(program_keypair_path.to_str().unwrap())
            .arg(program_artifact_path.to_str().unwrap())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .output()
            .expect("Must deploy");

        if !exit.status.success() {
            println!("There was a problem deploying: {:?}.", exit);
            std::process::exit(exit.status.code().unwrap_or(1));
        }

        println!("Deploy Successful");

        Ok(())
    })
}
