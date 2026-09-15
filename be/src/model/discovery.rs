#[derive(sqlx::FromRow)]
pub struct DiscoveryDatasourceTable {
    pub id: i64,
    pub name: String,
    pub display_name: String,
}
