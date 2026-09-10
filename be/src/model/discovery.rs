use crate::api::DiscoveryDatasourceTableListResult;

#[derive(sqlx::FromRow)]
pub struct DiscoveryDatasourceTable {
    pub id: i64,
    pub name: String,
    pub display_name: String,
}

impl From<DiscoveryDatasourceTable> for DiscoveryDatasourceTableListResult {
    fn from(value: DiscoveryDatasourceTable) -> Self {
        Self { id: value.id, name: value.name, display_name: value.display_name }
    }
}
