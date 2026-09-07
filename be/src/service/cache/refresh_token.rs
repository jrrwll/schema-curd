use std::sync::Arc;

use anyhow::bail;
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::{common::constants::REFRESH_TOKEN_TTL_SECONDS, infra::store::KvStore};

#[derive(Debug, Deserialize, Serialize)]
struct RefreshTokenRecord {
    user_id: i64,
    expires_at: i64,
}

const TOKEN_KEY_PREFIX: &str = "auth:refresh:";

fn token_key(user_id: i64, token_hash: &str) -> String {
    format!("{TOKEN_KEY_PREFIX}{user_id}:{token_hash}")
}

pub struct RefreshTokenCacheService;

impl RefreshTokenCacheService {
    pub async fn save(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
        token_hash: String,
    ) -> anyhow::Result<()> {
        let ttl_seconds = REFRESH_TOKEN_TTL_SECONDS;
        let expires_at = (Utc::now() + Duration::seconds(ttl_seconds as i64)).timestamp();
        let key = token_key(user_id, &token_hash);
        let value = serde_json::to_vec(&RefreshTokenRecord {
            user_id,
            expires_at,
        })?;
        if !kv_store.set_if_absent(key, value, ttl_seconds).await? {
            bail!("Refresh token digest collision");
        }
        Ok(())
    }

    pub async fn rotate(
        kv_store: Arc<dyn KvStore>,
        user_id: i64,
        old_token_hash: String,
        new_token_hash: String,
    ) -> anyhow::Result<Option<i64>> {
        let ttl_seconds = REFRESH_TOKEN_TTL_SECONDS;
        let now = Utc::now();
        let now_timestamp = now.timestamp();
        let new_expires_at = (now + Duration::seconds(ttl_seconds as i64)).timestamp();

        let old_key = token_key(user_id, &old_token_hash);
        let Some(old_value) = kv_store.get(old_key.clone()).await? else {
            return Ok(None);
        };
        let old_record: RefreshTokenRecord = serde_json::from_slice(&old_value)?;
        if old_record.user_id != user_id || old_record.expires_at <= now_timestamp {
            return Ok(None);
        }

        let new_key = token_key(user_id, &new_token_hash);
        let new_record = RefreshTokenRecord {
            user_id,
            expires_at: new_expires_at,
        };
        let new_value = serde_json::to_vec(&new_record)?;
        let moved = kv_store
            .move_if_value(old_key, old_value, new_key, new_value, ttl_seconds)
            .await?;
        Ok(moved.then_some(user_id))
    }

    pub async fn remove(kv_store: Arc<dyn KvStore>, user_id: i64) -> anyhow::Result<()> {
        let user_token_prefix = format!("{TOKEN_KEY_PREFIX}{user_id}:");
        kv_store.delete_prefix(user_token_prefix).await
    }
}
