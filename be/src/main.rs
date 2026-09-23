use anyhow::anyhow;
use axum::{middleware, Router};
use corers::axum::{tracing_middleware, LOCAL_IP};
use corers::util::get_local_ip;
use tracing::info;

use schema_curd::api::build_api_routers;
use schema_curd::common::config::AppConfig;
use schema_curd::common::global::init_global_vars;
use schema_curd::common::state::ApiState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if let Some(local_ip) = get_local_ip() {
        LOCAL_IP.set(local_ip).expect("LOCAL_IP already initialized");
    }

    let cfg = AppConfig::parse()?;
    cfg.init()?;
    init_global_vars(&cfg);

    let addr = cfg.build_addr();
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
