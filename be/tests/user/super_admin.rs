use corers::rng_alphanumeric;
use schema_curd::util::{hash_password, verify_password};

#[tokio::test]
async fn test_insert_sql() {
    let password = rng_alphanumeric(18);
    let password_hash = hash_password(password.clone())
        .await.unwrap();

    println!("hash_password super_admin:\n{}\n", hash_password("super_admin".to_owned())
        .await.unwrap());

    println!("username: super_admin");
    println!("password: {password}\n");
    println!(
        "insert into sys_user (name, password, display_name, super_admin) values ('super_admin', '{}', 'Super Admin', 1);",
        password_hash.replace('\'', "''")
    );

    let matched = verify_password(password.clone(), password_hash.clone()).await.unwrap();
    assert!(matched);
}
