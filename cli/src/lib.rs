use clap::Parser;
use anyhow::{Result};

mod commands;

#[derive(Parser, Debug)]
pub struct Opts {
    #[clap(subcommand)]
    command: Command
}

#[derive(Debug, Parser)]
pub enum Command {
    Deploy {
        #[clap(short, long, help = "The cluster URL you want to deploy to")]
        url: String
    }
}

pub fn entry(opts: Opts) -> Result<()> {
    match opts.command {
        Command::Deploy { url } => commands::deploy(&url),
    }
}

