use serum_dev_tools::Opts;
use anyhow::Result;
use clap::Parser;

fn main() -> Result<()> {
    serum_dev_tools::entry(Opts::parse())
}