use std::{
    fs,
    io::Error,
    path::Path,
    process::{Command, Stdio},
};

use anchor_client::Cluster;
use anyhow::Result;
use reqwest::blocking::Client;
use serde::Deserialize;
use solana_sdk::signature::{write_keypair_file, Keypair};

use crate::config::{Config, ConfigOverride};

#[derive(Deserialize, Debug)]
struct LatestResponse {
    id: u32,
}

#[derive(Deserialize, Debug)]
struct ArtifactResponse {
    binary: String,
}

const REGISTRY_URL: &str = "https://anchor.projectserum.com/api/v0";
const SERUM_DEX_ID: &str = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

pub fn deploy(cfg_override: &ConfigOverride, cluster: Option<Cluster>) -> Result<()> {
    with_config(cfg_override, |cfg| {
        let cluster = cluster.unwrap();
        let cluster_url = cluster.url();

        let provider_keypair = cfg.provider.wallet.to_string();

        let client = Client::new();

        let program_keypair_path = Path::new("./dev-tools/serum-dex-dev.json");
        let program_artifact_path = Path::new("./dev-tools/serum-dex.so");

        // If ./dev-tools does NOT exist
        if !Path::exists(Path::new("./dev-tools")) {
            println!("Fetching Artifact...");
            let latest_resp = client
                .get(format!("{REGISTRY_URL}/program/{SERUM_DEX_ID}/latest"))
                .send()?
                .json::<Vec<LatestResponse>>()?;

            let latest_build_id = latest_resp
                .get(0)
                .ok_or(Error::new(
                    std::io::ErrorKind::NotFound,
                    "No latest build found",
                ))?
                .id;

            let artifact_path = client
                .get(format!("{REGISTRY_URL}/build/{latest_build_id}/artifacts"))
                .send()?
                .json::<ArtifactResponse>()?
                .binary;

            let artifact_bytes = client.get(&artifact_path).send()?.bytes()?;

            fs::create_dir("./dev-tools")?;
            let program_keypair = Keypair::new();

            fs::write(program_artifact_path, artifact_bytes)?;
            write_keypair_file(&program_keypair, program_keypair_path).map_err(|e| {
                Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to write keypair file: {}", e),
                )
            })?;
        }

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

fn with_config<R>(cfg_override: &ConfigOverride, f: impl FnOnce(&Config) -> R) -> R {
    let cfg = Config::override_config(cfg_override).expect("failed to override config");

    let r = f(&cfg);

    r
}
