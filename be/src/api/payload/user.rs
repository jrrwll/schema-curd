use serde::{Deserialize, Serialize};
use validator::Validate;

use super::PageParam;

#[derive(Debug, Deserialize, Serialize)]
pub struct ProfileResult {
    pub id: i64,
    pub name: String,
    pub display_name: String,
    pub super_admin: bool,
}

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct UserListParam {
    #[serde(flatten)]
    pub page: PageParam,
    #[validate(length(max = 100))]
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub disabled: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UserListResult {
    pub id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub name: String,
    pub display_name: String,
    pub disabled: bool,
    pub super_admin: bool,
}

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct UserCreateParam {
    #[validate(length(max = 100))]
    pub name: String,
    #[validate(length(min = 4, max = 30))]
    pub password: String,
    #[validate(length(max = 100))]
    pub display_name: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UserCreateResult {}

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct UserUpdateParam {
    pub id: i64,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
}
