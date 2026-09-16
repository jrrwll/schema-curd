
## test

```shell
cd be
cargo test user::super_admin::test_insert_sql -- --nocapture
```

## role

| resource   | action                 | role             |
| ---------- | ---------------------- | ---------------- |
| user       | all                    | super_admin      |
| role       | all                    | super_admin      |
| datasource | create, delete         | super_admin      |
| datasource | update                 | datasource:write |
| table      | create, delete         | datasource:write |
| datasource | list, detail           | datasource:read  |
| table      | update                 | table:write      |
| entity     | create, update, delete | table:write      |
| table      | list, detail           | table:read       |
| entity     | list,detail            | table:read       |
