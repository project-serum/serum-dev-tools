use anyhow::Result;

use crate::config::{ConfigOverride, Config};

pub fn deploy(cfg_override: &ConfigOverride, url: Option<String>) -> Result<()> {
    with_config(cfg_override, |cfg| {
        println!("Deploying to: {}", url.unwrap());
        println!("Cluster: {:?}", cfg.provider.cluster);
        println!("Deploy Successful");
        Ok(())
    })
}

fn with_config<R>(cfg_override: &ConfigOverride, f: impl FnOnce(&Config) -> R) -> R {

    let cfg = Config::override_config(cfg_override).expect("failed to override config");

    let r = f(&cfg);

    r
}