use anyhow::Result;
use async_trait::async_trait;
use redis::{Client, Script, aio::MultiplexedConnection};

use super::KvStore;

const KEY_PREFIX: &str = "schema-curd:{kv}:";
const SCAN_BATCH_SIZE: usize = 500;
const MOVE_IF_VALUE_SCRIPT: &str = r#"
local current = redis.call('get', KEYS[1])
if not current or current ~= ARGV[1] or redis.call('exists', KEYS[2]) == 1 then
    return 0
end
redis.call('del', KEYS[1])
redis.call('set', KEYS[2], ARGV[2], 'ex', ARGV[3])
return 1
"#;
const INCREMENT_BELOW_SCRIPT: &str = r#"
local current = tonumber(redis.call('get', KEYS[1]) or '0')
if current >= tonumber(ARGV[1]) then
    return 0
end
current = redis.call('incr', KEYS[1])
if current == 1 then
    redis.call('expire', KEYS[1], ARGV[2])
end
return 1
"#;

pub(super) struct RedisKvStore {
    connection: MultiplexedConnection,
}

impl RedisKvStore {
    pub(super) async fn open(url: &str) -> Result<Self> {
        let client = Client::open(url)?;
        let connection = client.get_multiplexed_async_connection().await?;
        Ok(Self { connection })
    }
}

#[async_trait]
impl KvStore for RedisKvStore {
    async fn get(&self, key: String) -> Result<Option<Vec<u8>>> {
        let mut connection = self.connection.clone();
        Ok(redis::cmd("get")
            .arg(key_name(&key))
            .query_async(&mut connection)
            .await?)
    }

    async fn set(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool> {
        let mut connection = self.connection.clone();
        let result: Option<String> = redis::cmd("set")
            .arg(key_name(&key))
            .arg(value)
            .arg("ex")
            .arg(ttl_seconds)
            .query_async(&mut connection)
            .await?;
        Ok(result.is_some())
    }

    async fn set_if_absent(&self, key: String, value: Vec<u8>, ttl_seconds: u64) -> Result<bool> {
        let mut connection = self.connection.clone();
        let result: Option<String> = redis::cmd("set")
            .arg(key_name(&key))
            .arg(value)
            .arg("nx")
            .arg("ex")
            .arg(ttl_seconds)
            .query_async(&mut connection)
            .await?;
        Ok(result.is_some())
    }

    async fn move_if_value(
        &self,
        source_key: String,
        expected_value: Vec<u8>,
        destination_key: String,
        destination_value: Vec<u8>,
        ttl_seconds: u64,
    ) -> Result<bool> {
        let mut connection = self.connection.clone();
        let moved: i64 = Script::new(MOVE_IF_VALUE_SCRIPT)
            .key(key_name(&source_key))
            .key(key_name(&destination_key))
            .arg(expected_value)
            .arg(destination_value)
            .arg(ttl_seconds)
            .invoke_async(&mut connection)
            .await?;
        Ok(moved == 1)
    }

    async fn delete(&self, key: String) -> Result<()> {
        let mut connection = self.connection.clone();
        redis::cmd("del")
            .arg(key_name(&key))
            .query_async::<i64>(&mut connection)
            .await?;
        Ok(())
    }

    async fn delete_prefix(&self, prefix: String) -> Result<()> {
        let mut connection = self.connection.clone();
        let pattern = format!("{}*", key_name(&prefix));
        let mut cursor = 0_u64;
        let mut matched_keys = Vec::new();
        loop {
            let (next, keys): (u64, Vec<String>) = redis::cmd("scan")
                .arg(cursor)
                .arg("match")
                .arg(&pattern)
                .arg("count")
                .arg(SCAN_BATCH_SIZE)
                .query_async(&mut connection)
                .await?;
            matched_keys.extend(keys);
            if next == 0 {
                break;
            }
            cursor = next;
        }
        for keys in matched_keys.chunks(SCAN_BATCH_SIZE) {
            redis::cmd("del")
                .arg(keys)
                .query_async::<i64>(&mut connection)
                .await?;
        }
        Ok(())
    }

    async fn increment_below(&self, key: String, limit: u64, ttl_seconds: u64) -> Result<bool> {
        let mut connection = self.connection.clone();
        let incremented: i64 = Script::new(INCREMENT_BELOW_SCRIPT)
            .key(key_name(&key))
            .arg(limit)
            .arg(ttl_seconds)
            .invoke_async(&mut connection)
            .await?;
        Ok(incremented == 1)
    }
}

fn key_name(key: &str) -> String {
    format!("{KEY_PREFIX}{key}")
}
