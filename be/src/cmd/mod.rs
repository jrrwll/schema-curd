mod datasource;

use std::process;
use rexl::argparse::{ArgParserRunnable, FromArgs, run_with_args_tree, RunWithArgs, ArgParserError};
use serde::Serialize;

use datasource::*;

#[derive(Debug, Serialize, FromArgs)]
pub struct MainCli {
    pub help: bool,
}

impl MainCli {
    pub fn main(args: Vec<String>) {
        let Err(err) = Self::run_with_args(args) else {
            return;
        };
        eprintln!("{}", err);
        process::exit(1);
    }
}

impl ArgParserRunnable for MainCli {
    fn run(self) {
        if self.help {

        }
        println!("schema-curd-cli: try 'schema-curd-cli --help' for more information");
        process::exit(1);
    }
}

macro_rules! impl_runnable {
    ($my_type:ty) => {
        impl ArgParserRunnable for $my_type {
            fn run(self) {
                if self.help {
                    println!("{:?}", self);
                    return;
                }

                let runtime = crate::get_runtime();
                runtime.block_on(async {
                    self.run_async().await;
                });
            }
        }
    };
}

impl_runnable!(DatasourceRestoreCli);
impl_runnable!(DatasourceBackupCli);

run_with_args_tree! {
    MainCli {
        "ds,datasource" => DatasourceCli {
            "restore" => DatasourceRestoreCli,
            "backup" => DatasourceBackupCli,
        },
    }
}
