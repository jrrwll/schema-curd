use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use corers::axum::ApiError;
use serde::{Deserialize, Serialize};

use crate::common::state::ApiState;
use crate::service::AuthService;
use crate::{common::error::ErrorCode, service::AccessService};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthIdentity {
    pub user_id: i64,
}

pub struct Authenticated(pub AuthIdentity);

impl FromRequestParts<ApiState> for Authenticated {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _: &ApiState) -> Result<Self, Self::Rejection> {
        let Some(token) = parts.headers.get(header::AUTHORIZATION) else {
            return Err(ApiError::Unauthorized);
        };
        let token = token
            .to_str()
            .map_err(|_| ErrorCode::invalid_access_token.into_error())?
            .strip_prefix("Bearer ")
            .filter(|v| !v.is_empty())
            .ok_or_else(|| ErrorCode::invalid_access_token.into_error())?;

        let user_id = AuthService::parse_user_id_from_access_token(token).await?;
        Ok(Self(AuthIdentity { user_id }))
    }
}

pub struct CurrentSuperAdmin(pub AuthIdentity);

impl FromRequestParts<ApiState> for CurrentSuperAdmin {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &ApiState,
    ) -> Result<Self, Self::Rejection> {
        let Authenticated(identity) = Authenticated::from_request_parts(parts, state).await?;

        AccessService::require_super_admin(state, identity.user_id).await?;
        Ok(Self(identity))
    }
}
