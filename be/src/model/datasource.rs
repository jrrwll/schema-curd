use chrono::NaiveDateTime;
use corers::axum::ApiError;

use crate::{
    api::{DatasourceDetailResult, DatasourceListResult, EffectiveRoleEnum},
    util::{deserialize_config, format_datetime},
};

#[derive(sqlx::FromRow)]
pub struct DatasourceEntity {
    pub id: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub deleted_at: i64,
    pub created_by: Option<i64>,
    pub updated_by: Option<i64>,
    pub name: String,
    pub display_name: String,
    pub disabled: bool,
    pub url: String,
    pub username: String,
    pub password: String,
    pub config: Option<String>,
}

pub struct CreateDatasource {
    pub name: String,
    pub url: String,
    pub username: String,
    pub password: String,
    pub display_name: String,
    pub config: String,
}

pub struct UpdateDatasource {
    pub id: i64,
    pub url: String,
    pub username: String,
    pub password: Option<String>,
    pub display_name: String,
    pub config: String,
}

#[derive(sqlx::FromRow)]
pub struct MetaDatasource {
    pub id: i64,
    pub name: String,
    pub url: String,
    pub username: String,
    pub password: String,
    pub config: Option<String>,
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
