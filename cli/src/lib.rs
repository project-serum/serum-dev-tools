use crate::config::{ConfigOverride};
use clap::Parser;
use anyhow::{Result};

mod commands;
mod path;
pub mod config;

#[derive(Parser, Debug)]
pub struct Opts {
    #[clap(flatten)]
    pub cfg_override: ConfigOverride,

    #[clap(subcommand)]
    command: Command
}

#[derive(Debug, Parser)]
pub enum Command {
    Deploy {
        #[clap(short, long, help = "The cluster URL you want to deploy to")]
        url: Option<String>
    }
}

pub fn entry(opts: Opts) -> Result<()> {
    match opts.command {
        Command::Deploy { url } => commands::deploy(&opts.cfg_override, url),
    }
}

