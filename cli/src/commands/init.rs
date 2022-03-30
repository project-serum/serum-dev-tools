use std::{fs, io::Error, path::Path};

use anyhow::{anyhow, Result};
use reqwest::blocking::Client;
use serde::Deserialize;
use solana_sdk::signature::{write_keypair_file, Keypair};

use crate::config::{with_config, ConfigOverride};

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

pub fn init(cfg_override: &ConfigOverride) -> Result<()> {
    with_config(cfg_override, |_| {
        let client = Client::new();

        let program_keypair_path = Path::new("./dev-tools/serum-dex-dev.json");
        let program_artifact_path = Path::new("./dev-tools/serum-dex.so");

        // If ./dev-tools does NOT exist
        if !Path::exists(Path::new("./dev-tools")) {
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

            let program_keypair = Keypair::new();

            fs::create_dir("./dev-tools")?;
            fs::write(program_artifact_path, artifact_bytes)?;
            write_keypair_file(&program_keypair, program_keypair_path).map_err(|e| {
                Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to write keypair file: {}", e),
                )
            })?;

            println!("Initialized dev-tools!");
        } else {
            return Err(anyhow!("./dev-tools directory already exists"));
        }

        Ok(())
    })
}
