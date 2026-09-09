use corers::axum::ApiError;
use strum::{AsRefStr, EnumString};
use thiserror::Error;

#[derive(Debug, Error, AsRefStr, EnumString)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    #[error("Invalid username or password")]
    invalid_credentials,

    #[error("Access token is invalid or expired")]
    invalid_access_token,

    #[error("Refresh token is invalid or expired")]
    invalid_refresh_token,

    #[error("Operate failed")]
    operate_failed,

    #[error("User not found: {0}")]
    user_not_found(i64),

    #[error("User is disabled: {0}")]
    user_is_disabled(i64),

    #[error("Role not found: {0}")]
    role_not_found(i64),

    #[error("Roles not found")]
    roles_not_found,

    #[error("Role already existing: {0} {1}")]
    role_already_existing(String, i64),

    #[error("Role cannot grant: {0}")]
    role_cannot_grant(i64),
    
    #[error("Datasource not found: {0}")]
    datasource_not_found(i64),

    #[error("Datasource not found: {0}")]
    datasource_name_not_found(String),

    #[error("Datasource connect failed: {0}")]
    datasource_connect_failed(String),

    #[error("Datasource disabled: {0}")]
    datasource_disabled(String),

    #[error("Table not found: {0}")]
    table_not_found(i64),

    #[error("Table not found: {0}.{1}")]
    table_name_not_found(String, String),

    #[error("Table disabled: {0}")]
    table_disabled(i64),
}

impl ErrorCode {
    pub fn code(&self) -> &str {
        self.as_ref()
    }

    pub fn msg(&self) -> String {
        self.to_string()
    }

    pub fn into_error(self) -> ApiError {
        let code = self.code().to_string();
        let msg = self.msg();
        ApiError::Business(code, msg)
    }
}
