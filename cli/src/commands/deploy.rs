use std::io::Error;

use anyhow::Result;
use reqwest::blocking::Client;
use serde::Deserialize;
use std::fs;

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

pub fn deploy(cfg_override: &ConfigOverride, url: Option<String>) -> Result<()> {
    with_config(cfg_override, |cfg| {
        println!("Deploying to: {}", url.unwrap());
        println!("Cluster: {:?}", cfg.provider.cluster);

        let client = Client::new();

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

        println!("Writing artifact...");
        fs::write("test.so", artifact_bytes)?;

        println!("Deploy Successful");
        Ok(())
    })
}

fn with_config<R>(cfg_override: &ConfigOverride, f: impl FnOnce(&Config) -> R) -> R {
    let cfg = Config::override_config(cfg_override).expect("failed to override config");

    let r = f(&cfg);

    r
}
