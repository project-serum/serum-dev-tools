use std::path::Path;

pub fn is_initialized() -> bool {
    // Check if initialized
    if !Path::exists(Path::new("./dev-tools")) {
        return false;
    }

    true
}
