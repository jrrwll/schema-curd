use anyhow::Context;
use corers::axum::ApiError;
use regex::Regex;


pub fn is_pattern_match(text: &str, pattern: &str) -> Result<bool, ApiError> {
    Regex::new(&format!(r"^(?:{pattern})$"))
        .with_context(||format!("Pattern parse failed: {pattern}"))
        .map(|v| v.is_match(text))
        .map_err(Into::into)
}