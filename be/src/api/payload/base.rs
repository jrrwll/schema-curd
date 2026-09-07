use serde::{Deserialize, Serialize};
use validator::Validate;

use crate::common::constants::{MAX_PAGE_NO, MAX_PAGE_SIZE};

#[derive(Debug, Deserialize, Serialize, Validate)]
pub struct IdParam {
    #[validate(range(min = 1))]
    pub id: i64,
}

#[derive(Debug, Default, Deserialize, Serialize, Validate)]
pub struct PageParam {
    #[validate(range(min = 1, max = "MAX_PAGE_NO"))]
    pub page_no: u32,
    #[validate(range(min = 1, max = "MAX_PAGE_SIZE"))]
    pub page_size: u32,
}

impl PageParam {

    pub fn get_limit_offset(&self) -> (i64, i64) {
        let limit = i64::from(self.page_size);
        let offset = i64::from(self.page_no - 1) * limit;
        return (limit ,offset);
    }
}
