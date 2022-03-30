use anyhow::Result;
use clap::Parser;
use std::str::FromStr;

#[derive(Default, Debug, Parser)]
pub struct ConfigOverride {
    /// Wallet override.
    #[clap(global = true, long = "provider.wallet")]
    pub wallet: Option<WalletPath>,
}

// pub struct WithPath<T> {
//     inner: T,
//     path: PathBuf,
// }

// impl<T> WithPath<T> {
//     pub fn new(inner: T, path: PathBuf) -> Self {
//         Self { inner, path }
//     }

//     pub fn path(&self) -> &PathBuf {
//         &self.path
//     }

//     pub fn into_inner(self) -> T {
//         self.inner
//     }
// }

// impl<T> std::ops::Deref for WithPath<T> {
//     type Target = T;
//     fn deref(&self) -> &Self::Target {
//         &self.inner
//     }
// }

// impl<T> std::ops::DerefMut for WithPath<T> {
//     fn deref_mut(&mut self) -> &mut Self::Target {
//         &mut self.inner
//     }
// }

// impl<T> std::convert::AsRef<T> for WithPath<T> {
//     fn as_ref(&self) -> &T {
//         &self.inner
//     }
// }

#[derive(Debug, Default)]
pub struct Config {
    pub provider: ProviderConfig,
}

#[derive(Debug, Default)]
pub struct ProviderConfig {
    pub wallet: WalletPath,
}

impl Config {
    pub fn override_config(cfg_override: &ConfigOverride) -> Result<Config> {
        let mut cfg = Config::default();

        if let Some(wallet) = cfg_override.wallet.clone() {
            cfg.provider.wallet = wallet;
        }

        return Ok(cfg);
    }
}

pub fn with_config<R>(cfg_override: &ConfigOverride, f: impl FnOnce(&Config) -> R) -> R {
    let cfg = Config::override_config(cfg_override).expect("failed to override config");

    let r = f(&cfg);

    r
}

crate::home_path!(WalletPath, ".config/solana/id.json");
