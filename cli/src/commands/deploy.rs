use anyhow::Result;

pub fn deploy(url: &str) -> Result<()> {
    println!("deploying to {}", url);
    Ok(())
}