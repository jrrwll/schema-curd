use anyhow::Context;
use argon2::password_hash::{SaltString, rand_core::OsRng};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use corers::axum::ApiError;

pub async fn verify_password(password: String, encoded: String) -> Result<bool, ApiError> {
    tokio::task::spawn_blocking(move || {
        let hash = PasswordHash::new(&encoded)
            .context("Invalid user password hash")
            .map_err(ApiError::unknown)?;
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &hash)
            .is_ok())
    })
    .await
    .context("Password verification task failed")
    .map_err(ApiError::unknown)?
}

pub async fn hash_password(password: String) -> Result<String, ApiError> {
    tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|value| value.to_string())
            .context("Failed to hash password")
            .map_err(ApiError::unknown)
    })
    .await
    .context("Password hashing task failed")
    .map_err(ApiError::unknown)?
}
