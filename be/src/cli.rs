pub mod cmd;

use std::env;
use std::sync::OnceLock;

use rexl::argparse::RunWithArgs;
use validator::Validate;

use schema_curd::common::config::AppConfig;
use schema_curd::common::state::ApiState;

use cmd::*;

static API_STATE: OnceLock<ApiState> = OnceLock::new();

pub fn get_api_state() -> &'static ApiState {
    API_STATE.get().unwrap()
}

static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();

pub fn get_runtime() -> &'static tokio::runtime::Runtime {
    RUNTIME.get().unwrap()
}

pub fn init_runtime() -> anyhow::Result<()> {
    let runtime = tokio::runtime::Runtime::new()?;
    RUNTIME
        .set(runtime)
        .map_err(|_| anyhow::anyhow!("failed to init tokio runtime"))?;
    Ok(())
}

pub fn main() -> anyhow::Result<()> {
    let cfg = AppConfig::parse()?;
    cfg.validate()?;

    init_runtime()?;

    let state = get_runtime().block_on(async { ApiState::new(cfg).await.expect("failed to create ApiState") });
    API_STATE.set(state).map_err(|_| anyhow::anyhow!("failed to init API_STATE"))?;

    let args = env::args().skip(1).collect();
    MainCli::main(args);
    Ok(())
}
