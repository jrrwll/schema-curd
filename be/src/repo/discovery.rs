use crate::api::DiscoveryTableListParam;
use crate::common::constants::MAX_DISCOVERY_LIST_COUNT;
use crate::{api::DiscoveryDatasourceListParam, common::db::DbPool, model::DiscoveryDatasourceTable};

pub struct DiscoveryRepo;

impl DiscoveryRepo {
    pub async fn list_all_datasources(
        pool: &DbPool, param: DiscoveryDatasourceListParam,
    ) -> Result<Vec<DiscoveryDatasourceTable>, sqlx::Error> {
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));
        sqlx::query_as!(
            DiscoveryDatasourceTable,
            "
            select id, name, display_name
            from datasource_info
            where deleted_at = 0 and disabled = 0
                and coalesce(lower(name) like lower(?), true)
                and coalesce(lower(display_name) like lower(?), true)
            order by updated_at desc
            limit ?
            ",
            keyword.clone(),
            keyword,
            MAX_DISCOVERY_LIST_COUNT,
        )
        .fetch_all(pool)
        .await
    }

    pub async fn list_datasources(
        pool: &DbPool, param: DiscoveryDatasourceListParam, user_id: i64,
    ) -> Result<Vec<DiscoveryDatasourceTable>, sqlx::Error> {
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));
        sqlx::query_as!(
            DiscoveryDatasourceTable,
            "
            select t.id, t.name, t.display_name
            from (
                select ds.id, ds.name, ds.display_name
                from datasource_info ds
                where deleted_at = 0 and disabled = 0
                    and coalesce(lower(name) like lower(?), true)
                    and coalesce(lower(display_name) like lower(?), true)
                    and exists (
                        select 1 from table_info ti
                        inner join sys_user_role ur
                            on ur.resource_id = ti.id and ur.resource_type = 'table' and ur.user_id = ? and ur.deleted_at = 0
                        where ti.datasource_name = ds.name
                            and ti.deleted_at = 0 and ti.disabled = 0
                    )
                union
                select ds.id, ds.name, ds.display_name
                from datasource_info ds
                inner join sys_user_role ur
                    on ds.id = ur.resource_id and ur.resource_type = 'datasource' and ur.user_id = ? and ur.deleted_at = 0
                where ds.deleted_at = 0 and ds.disabled = 0
                    and coalesce(lower(ds.name) like lower(?), true)
                    and coalesce(lower(ds.display_name) like lower(?), true)
            ) as t
            order by t.id desc
            limit ?
            ",
            keyword.clone(), keyword.clone(), user_id,
            user_id, keyword.clone(), keyword,
            MAX_DISCOVERY_LIST_COUNT,
        )
        .fetch_all(pool)
        .await
    }

    pub async fn list_all_tables(
        pool: &DbPool, datasource_name: String, param: DiscoveryTableListParam,
    ) -> Result<Vec<DiscoveryDatasourceTable>, sqlx::Error> {
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));
        sqlx::query_as!(
            DiscoveryDatasourceTable,
            "
            select id, name, display_name
            from table_info
            where deleted_at = 0 and disabled = 0
                and datasource_name = ?
                and coalesce(lower(name) like lower(?), true)
                and coalesce(lower(display_name) like lower(?), true)
            limit ?
            ",
            datasource_name,
            keyword.clone(),
            keyword,
            MAX_DISCOVERY_LIST_COUNT,
        )
        .fetch_all(pool)
        .await
    }

    pub async fn list_tables(
        pool: &DbPool, datasource_name: String, param: DiscoveryTableListParam, user_id: i64,
    ) -> Result<Vec<DiscoveryDatasourceTable>, sqlx::Error> {
        let keyword = param.keyword.as_ref().map(|value| format!("%{value}%"));
        sqlx::query_as!(
            DiscoveryDatasourceTable,
            "
            select ti.id,
                ti.name,
                ti.display_name
            from table_info ti
            inner join sys_user_role ur 
                on ti.id = ur.resource_id and ur.resource_type = 'table' and ur.user_id = ? and ur.deleted_at = 0
            where ti.deleted_at = 0 and ti.disabled = 0
                and coalesce(lower(ti.name) like lower(?), true)
                and coalesce(lower(ti.display_name) like lower(?), true)
                and ti.datasource_name = ?
            limit ?
            ",
            user_id,
            keyword.clone(),
            keyword,
            datasource_name,
            MAX_DISCOVERY_LIST_COUNT,
        )
        .fetch_all(pool)
        .await
    }
}
