use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::{
    api::{EffectiveRoleEnum, PageParam},
    model::embed::DatasourceConfig,
};

#[derive(Debug, Default, Serialize, Deserialize, Validate)]
pub struct DatasourceListParam {
    #[serde(flatten)]
    pub page: PageParam,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub disabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatasourceListResult {
    pub id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub name: String,
    pub display_name: String,
    pub effective_role: EffectiveRoleEnum,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatasourceDetailResult {
    #[serde(flatten)]
    pub base: DatasourceListResult,
    pub url: String,
    pub username: String,
    pub password_configured: bool,
    pub config: DatasourceConfig,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct DatasourceCreateParam {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    pub display_name: String,
    #[serde(default)]
    pub config: DatasourceConfig,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct DatasourceUpdateParam {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: Option<String>,
    pub display_name: String,
    #[serde(default)]
    pub config: DatasourceConfig,
}
