# BeZQL

Module which facilities the handling of SQL database connections as well as providing a query builder and executioner.

## Adding Database Connections

Add a connection using the addConfig function.

```typescript
import * as bezql from "bezql";

bezql.addConfig("test", {
    "type": "MySQL",
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "",
    "database": "test"
});
```

## Remove Database Connection

Use removeConfig to remove a connection and close any open connection pools.

```typescript
bezql.removeConfig("test")
```

## Start a Query

Use startQuery to begin building a query on a given connection.

```typescript
const query = bezql.startQuery("test");
```

## Selecting

Use the various functions to build up a select query before using "fetch" to return the results, for example:

```typescript
//select from users
query.table("users");

query.cols(["first_name", "surname"]);

query.where("id", "=", 1, true);

query.fetch().then(results=>{
    console.log(results.rows);
});
```

### Joining

You can use the various join methods to join tables together

```typescript
query.join("user_settings", "users.id", "user_settings.user_id");
query.leftJoin("user_settings", "users.id", "user_settings.user_id");

//more complex joins

query.leftJoin("user_posts", (query)=>{
    query.on("users.id", "=", "user_posts.user_id", false);
    query.on("user_posts.date_posted", "<", "2022-06-11", true);
    return query;
})

const subQuery = query.newQuery();
subQuery.table("user_jobs");
subQuery.cols(["COUNT(*) job_count", "user_id"]);
subQuery.group(["user_id"]);

query.leftJoin(subQuery, "user_job_count", "user_job_count.user_id", "users.id");
```