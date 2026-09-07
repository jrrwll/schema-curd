use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct DatasourceConfig {
    #[serde(default)]
    pub bool_as_int: bool,
}
