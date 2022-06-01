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
    /// Initializes a dev-tools workspace
    Init,
    /// Prints the address of the dex program
    Instance,
    /// Deploys the dex program to the specified cluster
    Deploy {
        /// The cluster to deploy to
        cluster: Cluster,

        /// The script to run after deploying
        #[clap(long)]
        script: Option<String>,
    },
}

pub fn entry(opts: Opts) -> Result<()> {
    match opts.command {
        Command::Init => commands::init(),
        Command::Instance => commands::instance(),
        Command::Deploy { cluster, script } => {
            commands::deploy(&opts.cfg_override, cluster, script)
        }
    }
}
