use std::net::{IpAddr, Ipv4Addr};

use anyhow::{Context, Result};
use corers::tracing::LeveledRollingFileAppender;
use tracing_appender::rolling::{Builder, RollingFileAppender, Rotation};
use tracing_subscriber::fmt;
use tracing_subscriber::{
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
    Layer,
};
use serde::Deserialize;

use validator::Validate;

use crate::common::constants::{DEFAULT_DATABASE_URL, DEFAULT_LISTEN_PORT, MIN_JWT_SECRET_LENGTH};

#[derive(Deserialize, Validate)]
pub struct AppConfig {
    #[serde(default = "default_listen_host")]
    pub listen_host: IpAddr,
    #[serde(default = "default_listen_port")]
    pub listen_port: u16,
    #[serde(default = "default_database_url")]
    pub database_url: String,
    #[validate(length(min = "MIN_JWT_SECRET_LENGTH"))]
    pub jwt_secret: String,
    pub kv_store_url: Option<String>,

    pub log_level: Option<String>,
    pub log_dir: Option<String>,
    pub log_max_files: Option<usize>,
}

fn default_listen_host() -> IpAddr {
    IpAddr::V4(Ipv4Addr::UNSPECIFIED)
}

fn default_listen_port() -> u16 {
    DEFAULT_LISTEN_PORT
}

fn default_database_url() -> String {
    DEFAULT_DATABASE_URL.to_owned()
}

impl AppConfig {
    pub fn parse() -> Result<Self> {
        if let Err(error) = dotenvy::dotenv() {
            if !error.not_found() {
                return Err(error).context("Failed to load .env");
            }
        }
        envy::from_env().context("Failed to load environment configuration")
    }

    pub fn build_addr(&self) -> String {
        format!("{}:{}", self.listen_host, self.listen_port)
    }

    pub fn init_tracing(&self) {
        // export RUST_LOG=debug
        let env_filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| self.log_level.as_deref().unwrap_or("debug").into());

        let log_dir = self.log_dir.as_deref().unwrap_or("logs");
        let appender = LeveledRollingFileAppender::new(|| self.appender_builder(), log_dir);

        let level_layer = fmt::layer()
            .json()
            .with_ansi(false)
            .with_target(false)
            .with_file(true)
            .with_line_number(true)
            // .with_writer(level_appender.with_ansi(false).and(std::io::stdout))
            .with_writer(appender)
            .and_then(
                fmt::layer()
                    .with_ansi(true)
                    .with_target(false)
                    .with_file(true)
                    .with_line_number(true)
                    .with_writer(std::io::stdout),
            );

        tracing_subscriber::registry()
            .with(env_filter)
            .with(level_layer)
            .init();
    }

    fn appender_builder(&self) -> Builder {
        let mut builder = RollingFileAppender::builder().rotation(Rotation::DAILY);
        if let Some(max_log_files) = self.log_max_files {
            builder = builder.max_log_files(max_log_files);
        }
        builder
    }
}
