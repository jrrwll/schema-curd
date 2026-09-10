use anyhow::Context;
use corers::axum::ApiError;
use corers::{encode_base64_url_safe, rng_bytes, sha256hex};

use crate::api::{AccessClaimPublic, AuthTokenResult, LoginParam, RefreshParam};
use crate::common::global::get_jwt_provider;
use crate::common::state::ApiState;
use crate::repo::AuthRepo;
use crate::util::verify_password;

use super::RefreshTokenCacheService;

pub struct AuthService;

impl AuthService {
    pub async fn parse_user_id_from_access_token(access_token: &str) -> Result<i64, ApiError> {
        let claims: AccessClaimPublic = get_jwt_provider()
            .decode_token(access_token)
            .map_err(|_| invalid_access_token())?;

        if claims.token_type != "access" {
            return Err(invalid_access_token());
        }
        let user_id = claims.sub.parse().map_err(|_| invalid_access_token())?;
        Ok(user_id)
    }

    pub async fn login(state: &ApiState, param: LoginParam) -> Result<AuthTokenResult, ApiError> {
        let user = AuthRepo::find_user(&state.pool, &param.name)
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| invalid_credentials())?;
        if user.disabled {
            return Err(ApiError::Forbidden("User is disabled".to_owned()));
        }
        if !verify_password(param.password, user.password).await? {
            return Err(invalid_credentials());
        }

        let user_id = user.id;
        let access_token = issue_access_token(user_id)?;
        let (refresh_token, refresh_token_hash) = issue_refresh_token(user_id);

        // store
        RefreshTokenCacheService::save(state.kv_store.clone(), user_id, refresh_token_hash)
            .await
            .map_err(ApiError::unknown)?;

        Ok(AuthTokenResult { access_token, refresh_token })
    }

    pub async fn refresh(state: &ApiState, param: RefreshParam) -> Result<AuthTokenResult, ApiError> {
        let user_id = parse_user_id_from_refresh_token(&param.refresh_token).ok_or_else(|| invalid_refresh_token())?;
        let old_token_hash = sha256hex(&param.refresh_token);

        let access_token = issue_access_token(user_id)?;
        let (refresh_token, new_token_hash) = issue_refresh_token(user_id);
        RefreshTokenCacheService::rotate(state.kv_store.clone(), user_id, old_token_hash, new_token_hash)
            .await
            .map_err(ApiError::unknown)?
            .ok_or_else(|| invalid_refresh_token())?;

        // check user status
        let is_active = AuthRepo::is_user_active(&state.pool, user_id)
            .await
            .map_err(ApiError::unknown)?;
        if !is_active {
            RefreshTokenCacheService::remove(state.kv_store.clone(), user_id)
                .await
                .map_err(ApiError::unknown)?;
            return Err(invalid_refresh_token());
        }
        Ok(AuthTokenResult { access_token, refresh_token })
    }
}

fn issue_access_token(user_id: i64) -> Result<String, ApiError> {
    let claims = AccessClaimPublic::new(user_id.to_string(), "access".to_owned());
    get_jwt_provider()
        .encode_token(claims)
        .context("Failed to issue access token")
        .map_err(ApiError::unknown)
}

fn issue_refresh_token(user_id: i64) -> (String, String) {
    let bytes: [u8; 32] = rng_bytes();
    let value = format!("{user_id}.{}", encode_base64_url_safe(bytes));
    let token_hash = sha256hex(&value);
    (value, token_hash)
}

fn parse_user_id_from_refresh_token(value: &str) -> Option<i64> {
    let (user_id, random) = value.split_once('.')?;
    let user_id = user_id.parse().ok()?;
    (user_id > 0 && !random.is_empty() && !random.contains('.')).then_some(user_id)
}

fn invalid_access_token() -> ApiError {
    ApiError::Unauthorized("Access token is invalid or expired".to_owned())
}

fn invalid_refresh_token() -> ApiError {
    ApiError::Unauthorized("Refresh token is invalid or expired".to_owned())
}

fn invalid_credentials() -> ApiError {
    ApiError::Unauthorized("Invalid username or password".to_owned())
}
