use crate::config::ConfigOverride;
use anchor_client::Cluster;
use anyhow::Result;
use clap::Parser;

mod commands;
pub mod config;
mod errors;
mod path;
mod utils;

#[derive(Parser, Debug)]
pub struct Opts {
    #[clap(flatten)]
    pub cfg_override: ConfigOverride,

    #[clap(subcommand)]
    command: Command,
}

#[derive(Debug, Parser)]
pub enum Command {
    Init,
    Deploy { cluster: Option<Cluster> },
}

pub fn entry(opts: Opts) -> Result<()> {
    match opts.command {
        Command::Init => commands::init(),
        Command::Deploy { cluster } => commands::deploy(&opts.cfg_override, cluster),
    }
}
