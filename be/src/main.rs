use anyhow::anyhow;
use axum::Router;
use tracing::info;
use validator::Validate;

use schema_curd::api::build_api_routers;
use schema_curd::common::config::AppConfig;
use schema_curd::common::state::ApiState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cfg = AppConfig::parse()?;
    cfg.validate()?;
    let addr = cfg.build_addr();
    cfg.init();

    let state = ApiState::new(cfg).await?;

    let app = Router::new()
        .nest("/api", build_api_routers())
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
