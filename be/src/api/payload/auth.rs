use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::common::constants::{ACCESS_TOKEN_TTL_SECONDS, MAX_REFRESH_TOKEN_LENGTH};

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct LoginParam {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(length(min = 1, max = 100))]
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RefreshParam {
    #[validate(length(min=1, max=MAX_REFRESH_TOKEN_LENGTH))]
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthTokenResult {
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Deserialize, Serialize)]
pub struct AccessClaimPublic {
    pub sub: String,
    pub iat: i64,
    pub exp: i64,
    pub token_type: String,
}

impl AccessClaimPublic {
    pub fn new(user_id: String, token_type: String) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id,
            iat: now.timestamp(),
            exp: (now + Duration::seconds(ACCESS_TOKEN_TTL_SECONDS)).timestamp(),
            token_type,
        }
    }
}
