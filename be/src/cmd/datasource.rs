use rexl::argparse::{ArgParserRunnable, FromArgs};
use serde::Serialize;

use crate::get_api_state;

#[derive(Debug, Serialize, FromArgs)]
pub struct DatasourceCli {
    pub help: bool,
}

impl ArgParserRunnable for DatasourceCli {
    fn run(self) {
        println!("{:?}", self);
    }
}

#[derive(Debug, Serialize, FromArgs)]
pub struct DatasourceRestoreCli {
    pub help: bool,
}

#[derive(Debug, Serialize, FromArgs)]
pub struct DatasourceBackupCli {
    pub help: bool,
}

impl DatasourceRestoreCli {
    pub async fn run_async(self) {
        let state = get_api_state();
        println!("success to restore datasources: {:?}", "");
    }
}

impl DatasourceBackupCli {
    pub async fn run_async(self) {
        let state = get_api_state();
        println!("success to backup datasources: {:?}", "");
    }
}
