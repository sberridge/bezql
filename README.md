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

Use the available methods to build up a select query before using "fetch" to return the results, for example:

```typescript
//select from users
query.table("users");

query.cols(["first_name", "surname"]);

query.fetch().then(results=>{
    console.log(results.rows);
});
```

### Conditions

Various "where" methods are available to add conditions to a query, these include:

* where
* whereNull
* whereNotNull
* whereIn
* whereNotIn

```typescript
//field, comparator, value, parameterise value?
query.where("id", "=", 1, true);

query.whereNull("field");

query.whereNotNull("field");

//field, values to match, parameterise values?
query.whereIn("id", [1,2,3], true);
query.whereNotIn("country_id", [1,2,3], true);


//whereIn with subquery
const subQuery = bezql.startQuery("test");
subQuery.table("countries");
subQuery.cols(["id"]);
subQuery.where("continent_id", "=", 1, true);

query.whereIn("country_id", subQuery);
```

#### Handling Logic

Queries with complex logic requirements can be handled using the following methods:

* and
* or
* openBracket
* closeBracket

```typescript
query.openBracket();
query.where("title_id", "=", 1, true);
query.or();
query.where("country_id", "=", 2, true);
query.closeBracket();

query.and();

query.where("date_created", ">", "2022-06-12 00:00:00", true);
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

### Limiting, offsetting, ordering, and grouping

The following methods allow for limiting results, offsetting the returned rows, ordering the results, and grouping for aggregate queries:

* limit
* order
* group
* offset

```typescript
query.limit(10);
query.offset(10);

//order by surname then first_name
query.order("surname", "ASC");
query.order("first_name", "ASC");

//group by given fields
query.group(["first_group_field", "second_group_field"]);
```

### Streaming Results

For queries with larger data sets it is usually more efficient to stream the results in order to handle a smaller sub set of results at a time.

This can be accomplished using the stream method.

```typescript
//number to return at a time, callback function
await query.stream(10, async (results)=>{

    //handle result set

    //return true to get next set or false to exit the stream early
    return true
});
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

Updating records uses the conditional methods, combined with the update and save method.

```typescript
updateQuery.update({
    "is_active": 0
}, true);

updateQuery.whereIn("id", [1,2,3]);

const updateResult = await updateQuery.save();
```

## Delete Records

Deleting records can be done using the conditional methods combined with the delete method.

```typescript
deleteQuery.where("id", "=", 1, true);

const deleteResult = await deleteQuery.delete();
```