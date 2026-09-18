use anyhow::anyhow;
use axum::{Router, middleware};
use corers::axum::{tracing_middleware, LOCAL_IP};
use corers::util::get_local_ip;
use tracing::info;
use validator::Validate;

use schema_curd::api::build_api_routers;
use schema_curd::common::config::AppConfig;
use schema_curd::common::state::ApiState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if let Some(local_ip) = get_local_ip() {
        LOCAL_IP.set(local_ip).expect("LOCAL_IP already initialized");
    }

    let cfg = AppConfig::parse()?;
    cfg.validate()?;
    let addr = cfg.build_addr();
    cfg.init();

    let state = ApiState::new(cfg).await?;

    let app = Router::new().nest("/api", build_api_routers())
        .layer(middleware::from_fn(tracing_middleware))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| anyhow!("Failed to bind addr {}: {}", &addr, e))?;
    info!("listening on {}", &addr);
    axum::serve(listener, app.into_make_service())
        .await
        .map_err(|e| anyhow!("Failed to start HTTP server: {}", e))?;
    Ok(())
}
