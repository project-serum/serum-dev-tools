use crate::config::ConfigOverride;
use anchor_client::Cluster;
use anyhow::Result;
use clap::Parser;

mod commands;
pub mod config;
mod path;

#[derive(Parser, Debug)]
pub struct Opts {
    #[clap(flatten)]
    pub cfg_override: ConfigOverride,

    #[clap(subcommand)]
    command: Command,
}

#[derive(Debug, Parser)]
pub enum Command {
    Deploy { cluster: Option<Cluster> },
}

pub fn entry(opts: Opts) -> Result<()> {
    match opts.command {
        Command::Deploy { cluster } => commands::deploy(&opts.cfg_override, cluster),
    }
}
