use serde::{Deserialize, Serialize};
use strum::{Display, EnumString};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Deserialize, Serialize, EnumString, Display)]
#[serde(rename_all = "lowercase")]
#[strum(serialize_all = "lowercase")]
pub enum ResourceTypeEnum {
    Datasource,
    Table,
}

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Hash,
    PartialOrd,
    Ord,
    Deserialize,
    Serialize,
    EnumString,
    Display,
)]
#[serde(rename_all = "snake_case")]
pub enum RoleEnum {
    Read,
    Write,
}

impl RoleEnum {
    pub fn implies(&self, other: Self) -> bool {
        *self >= other
    }
}
