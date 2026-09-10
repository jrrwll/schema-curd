pub use payload::*;

mod payload;

mod auth;
mod datasource;
mod discovery;
mod entity;
mod physical;
mod role;
mod table;
mod user;

use axum::Router;
use corers::axum::ApiError;

use crate::common::state::ApiState;

pub fn build_api_routers() -> Router<ApiState> {
    Router::new()
        .merge(auth::get_routes())
        .merge(datasource::get_routes())
        .merge(discovery::get_routes())
        .merge(entity::get_routes())
        .merge(physical::get_routes())
        .merge(role::get_routes())
        .merge(table::get_routes())
        .merge(user::get_routes())
        .fallback(api_not_found)
        .method_not_allowed_fallback(method_not_allowed)
}

async fn api_not_found() -> ApiError {
    ApiError::NotFound
}

async fn method_not_allowed() -> ApiError {
    ApiError::MethodNotAllowed
}
