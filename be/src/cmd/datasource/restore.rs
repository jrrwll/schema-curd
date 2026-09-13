use crate::get_api_state;
use rexl::argparse::FromArgs;
use serde::Serialize;

#[derive(Debug, Serialize, FromArgs)]
pub struct DatasourceRestoreCli {
    pub help: bool,
    #[arg_parser(position = 0)]
    pub input_path: Option<String>,
}

impl DatasourceRestoreCli {
    pub async fn run_async(self) {
        let state = get_api_state();

        println!("success to restore datasources: {:?}", "");
    }
}

