# BeZQL

Package which handles SQL database connections as well as providing a query builder and executioner.

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

### Supported Databases

This package currently supports MySQL and Postgres connections.

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

## Inserting Records

Records can be inserted using the insert and save methods.

```typescript
const insert = bezql.startQuery("test");

insert.table("users");

//single record
insert.insert({
    "first_name": "George",
    "surname": "Jennings"
}, true);

const insertResult = await insert.save();


//multiple records
const multipleInsert = bezql.startQuery("test");
multipleInsert.insert([
    {
        "first_name": "Lizzie",
        "surname": "Smith"
    },
    {
        "first_name": "Kathrine",
        "surname": "Earling"
    }
], true);

const multiResult = await multipleInsert.save();
```

## Update Records

Updating records uses the same conditional methods as selecting, combined with the update and save method.

```typescript
updateQuery.update({
    "is_active": 0
}, true);

updateQuery.whereIn("id", [1,2,3]);

const updateResult = await updateQuery.save();
```