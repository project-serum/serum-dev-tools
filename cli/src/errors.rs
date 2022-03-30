use thiserror::Error;

#[derive(Error, Debug)]
pub enum DevToolError {
    #[error("./dev-tools not initialized")]
    NotInitialized,
}
