use std::sync::{Arc, OnceLock};

use anyhow::Context;
use corers::util::JwtProvider;

use crate::common::config::AppConfig;

static JWT_PROVIDER: OnceLock<Arc<JwtProvider>> = OnceLock::new();

pub fn init_jwt_provider(config: &AppConfig) {
    let jwt_provider = JwtProvider::from_secret(config.jwt_secret.clone())
        .context("failed to init jwt_provider")
        .unwrap();
    JWT_PROVIDER
        .set(Arc::new(jwt_provider))
        .expect("JWT_PROVIDER already initialized");
}

pub fn get_jwt_provider() -> Arc<JwtProvider> {
    JWT_PROVIDER.get().expect("JWT_PROVIDER has not initialized").clone()
}
