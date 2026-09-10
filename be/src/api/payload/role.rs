use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::model::embed::{ResourceTypeEnum, RoleEnum};

use super::PageParam;

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleListParam {
    #[serde(flatten)]
    pub page: PageParam,
    #[serde(default)]
    pub user_ids: Vec<i64>,
    #[serde(default)]
    pub resource_type: Option<ResourceTypeEnum>,
    #[serde(default)]
    pub resource_ids: Vec<i64>,
    #[serde(default)]
    pub roles: Vec<RoleEnum>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoleListResult {
    pub id: i64,
    pub created_at: String,
    pub user_id: i64,
    pub user_name: String,
    pub user_display_name: String,
    pub user_disabled: bool,
    pub role: RoleEnum,
    pub resource_type: ResourceTypeEnum,
    pub resource_id: i64,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleGrantParam {
    pub user_id: i64,
    pub resource_type: ResourceTypeEnum,
    pub resource_id: i64,
    pub role: RoleEnum,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleBatchGrantUserParam {
    pub resource_type: ResourceTypeEnum,
    pub resource_id: i64,
    #[validate(length(min = 1, max=100))]
    pub items: Vec<RoleBatchGrantUserItem>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleBatchGrantUserItem {
    pub user_id: i64,
    pub role: RoleEnum,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleBatchGrantResourceParam {
    pub user_id: i64,
    pub resource_type: ResourceTypeEnum,
    #[validate(length(min = 1, max=100))]
    pub items: Vec<RoleBatchGrantResourceItem>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleBatchGrantResourceItem {
    pub resource_id: i64,
    pub role: RoleEnum,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleUpdateParam {
    pub id: i64,
    pub role: RoleEnum,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleUserListParam {
    pub user_id: i64,
    pub datasource_name: Option<String>,
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleResourceListParam {
    pub datasource_name: Option<String>,
    pub table_id: Option<i64>,
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct RoleUserResourceListResult {
    pub id: i64,
    pub name: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EffectiveRoleEnum {
    None,
    Read,
    Write,
}

impl From<Option<RoleEnum>> for EffectiveRoleEnum {
    fn from(value: Option<RoleEnum>) -> Self {
        let Some(role) = value else {
            return Self::None;
        };
        match role {
            RoleEnum::Read => Self::Read,
            RoleEnum::Write => Self::Write,
        }
    }
}
