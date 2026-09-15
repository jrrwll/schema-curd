use corers::axum::ApiError;
use corers::time::format_datetime;
use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::{
    api::{EffectiveRoleEnum, PageParam},
    model::embed::DatasourceConfig,
};
use crate::model::DatasourceEntity;
use crate::util::deserialize_config;

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

impl From<DatasourceEntity> for DatasourceListResult {
    fn from(value: DatasourceEntity) -> Self {
        Self {
            id: value.id,
            created_at: format_datetime(value.created_at),
            updated_at: format_datetime(value.updated_at),
            name: value.name,
            display_name: value.display_name,
            effective_role: EffectiveRoleEnum::Read,
        }
    }
}

impl TryFrom<DatasourceEntity> for DatasourceDetailResult {
    type Error = ApiError;

    fn try_from(value: DatasourceEntity) -> Result<Self, Self::Error> {
        Ok(Self {
            url: value.url.clone(),
            username: value.username.clone(),
            password_configured: !value.password.clone().is_empty(),
            config: deserialize_config(value.config.clone())?,
            base: value.into(),
        })
    }
}
