import SQLResult from "../../classes/SQLResult";
import iSQL from "../../interfaces/iSQL";
import ConnectionConfig from "../../types/ConnectionConfig";
import QueryOptions from "./classes/QueryOptions";
import * as mysql from 'mysql2';
import QueryConstraints from "../../classes/QueryConstraints";
import WeightedCondition from "../../classes/WeightedCondition";
import Comparator from "./../../types/Comparator";
import CRUDOperation from "./../../types/CRUDOperation";
import Event from "./../../types/Event";
import reservedWords from "./reservedWords";
import iPagination from "./../../interfaces/iPagination";
import DBConnection from "../../classes/DBConnection";

export default class MySQLDriver implements iSQL {

    private transactionConnection:mysql.PoolConnection | undefined;
    private queryOptions: QueryOptions;
    private config:ConnectionConfig;
    private configName:string;
    private events: Map<
            "before" | "after", Map<
                CRUDOperation, ((e:Event)=>Promise<boolean>)[]
            >
        > | undefined;

    private eventsSuppressed = false;
    private static pools: Map<string, mysql.Pool> = new Map();

    constructor(configName: string, config:ConnectionConfig) {
        this.config = config;
        this.configName = configName;
        const constraints = new QueryConstraints(false);
        this.queryOptions = new QueryOptions(constraints);
    }

    private connect() {
        let pool = MySQLDriver.pools.get(this.configName);
        if(!pool) {
            let config:mysql.PoolOptions = {
                connectionLimit: 100,
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                port: this.config.port
            };
            pool = mysql.createPool(config);
            MySQLDriver.pools.set(this.configName, pool);
        }
        return pool;
    }

    private getConnection(): Promise<mysql.PoolConnection> {
        return new Promise((resolve,reject)=>{
            if(this.transactionConnection) {
                return resolve(this.transactionConnection);
            }
            const connection = this.connect();
            connection.getConnection((error, connection)=>{
                if(error) {
                    return reject(error);
                }
                return resolve(connection);
            });
        });
    }

    public closePool(key: string):Promise<void> {
        return new Promise((resolve,reject)=>{
            const connection = MySQLDriver.pools.get(key);
            if(connection) {
                connection.end((err)=>{
                    MySQLDriver.pools.delete(key);
                    resolve();
                })
            } else {
                resolve();
            }
        });  
    }

    public addEvents(events: Map<
        "before" | "after", Map<
            CRUDOperation, ((e:Event)=>Promise<boolean>)[]
        >
    > ): void {
        this.events = events;
    }

    public suppressEvents(suppress: boolean): iSQL {
        this.eventsSuppressed = suppress;
        return this;
    }

    public beginTransaction(): Promise<boolean> {
        return new Promise(async (resolve,reject)=>{
            this.transactionConnection = await this.getConnection();
            this.transactionConnection.beginTransaction((err)=>{
                if(err) {
                    this.transactionConnection?.release();
                    return reject(err);
                }
                resolve(true);    
            });
            
        });
    }

    public rollback(commitError?:mysql.QueryError | undefined): Promise<boolean> {
        return new Promise((resolve,reject)=>{
            if(typeof this.transactionConnection === "undefined") {
                return reject("No transaction in progress");
            }
            this.transactionConnection.rollback(() => {
                this.transactionConnection?.release();
                if(commitError) {
                    return reject(commitError);
                }
                return resolve(true);
            });
        });        
    }
    
    public commit(): Promise<boolean> {
        return new Promise((resolve,reject)=>{
            if(typeof this.transactionConnection === "undefined") {
                return reject("No transaction in progress");
            }
            this.transactionConnection.commit((err)=>{
                if(err) {
                    return resolve(this.rollback(err));
                }
                this.transactionConnection?.release();
                resolve(true);
            });
        });        
    }

    public raw<TResult = any>(query: string, params: any): Promise<SQLResult<TResult>> {
        this.queryOptions.params = [];
        if(typeof params !== "undefined") {
            if(Array.isArray(params)){
                params.forEach((param)=>{
                    this.queryOptions.params?.push(param);
                });
            } else {
                throw new Error("Must pass an array containing param values when running MySQL query");
            }
        }
        return this.execute<TResult>(query);
    }

    public newQuery() {
        const query = new MySQLDriver(this.configName, this.config);
        if(this.transactionConnection) {
            query.transactionConnection = this.transactionConnection;
        }
        if(this.events) {
            query.addEvents(this.events);
        }        
        return query;
    }

    public static addReservedWord(word: string) {
        reservedWords.push(word);
    }

    private escape(word:string): string {
        let alias:string|null = null;
        if(word.includes(" ")) {
            let wordAndAlias = word.split(" ");
            alias = this.escape.call(this,wordAndAlias[1]);
            word = wordAndAlias[0];
        }
        if(word.includes('.')) {
            let wordParts = word.split('.');
            word = wordParts.map((val)=>{
                return this.escape.call(this,val);
            }).join('.');
        } else {
            if(reservedWords.includes(word.toLowerCase())) {
                word = '`' + word + '`';
            }
        }
        if(alias) {
            word += ` ${alias}`;
        }
        return word;
    }

    public getParams() {
        const params = this.queryOptions.params;
        if(!params) {
            return [];
        }
        return params;
    }

    public getParamNames() {
        return [];
    }

    public increaseParamNum(num: number) {
        this.queryOptions.queryConstraints.increaseParamNum(num);
    }

    public getParamNum(): number {
        return this.queryOptions.queryConstraints.getParamNum();
    }

    public setIncrementingField(field: string): iSQL {
        return this;
    }

    public getConstraints() {
        return this.queryOptions.queryConstraints;
    }

    public table(tableName: MySQLDriver, tableAlias: string): MySQLDriver
    public table(tableName: string): MySQLDriver
    public table(tableName: string | MySQLDriver, tableAlias?: string): MySQLDriver {
        if(typeof tableName === "string") {
            this.queryOptions.tableName = this.escape(tableName);
        } else if(tableAlias) {
            if(tableName instanceof DBConnection) {
                const selectColumns = tableName.getSelectColumns();
                tableName = tableName.getDBHandler() as MySQLDriver;
                tableName.cols(selectColumns);
            }
            this.queryOptions.subStatement = [tableName, tableAlias];
        }
        
        return this;
    }

    public cols(selectColumns : string[]) : MySQLDriver {
        this.queryOptions.selectColumns = selectColumns.map((col)=>{ return this.escape.call(this,col); });       
        return this;
    }



    public generateConditional(ifThis:string,thenVal:string,elseVal:string):string {
        return "if(" + ifThis + ', ' + thenVal + ', ' + elseVal + ")";
    }

    private applyWeightedConditions() {
        let newParams:any[] = [];
        if(this.queryOptions.weightedConditions.length > 0) {
            let weightedConditionQueries = this.queryOptions.weightedConditions.map((condition:WeightedCondition)=>{
                return condition.applyCondition(this,newParams,[]);
            });
            this.queryOptions.selectColumns.push(weightedConditionQueries.join(' + ') + ' __condition_weight__');
            this.queryOptions.ordering.unshift({
                'field': '__condition_weight__',
                'direction': "DESC"
            });
        }
        return newParams;
    }

    private applySubStatement(): [string, any[]] {
        if(!this.queryOptions.subStatement) {
            return ["",[]]
        }
        const newParams: any[] = [];
        const query = `(${this.queryOptions.subStatement[0].generateSelect()}) ${this.queryOptions.subStatement[1]} `;
        this.queryOptions.subStatement[0].getParams().forEach(function(param) {
            newParams.push(param);
        });
        return [query, newParams];
    }

    private applyJoins(): [string, any[]] {
        const newParams:any[] = [];
        const joinStrings:string[] = [];
        this.queryOptions.joins.forEach(function(join : any) {
            join.params.forEach((param:any)=>{
                newParams.push(param);
            });
            joinStrings.push(` ${join.type} ${join.table} ON ${(join.query.applyWheres(newParams,[]))} `);
        });
        
        return [joinStrings.join(" "), newParams];
    }

    public generateSelect() {
        
        const queryOptions = this.queryOptions;
        if(!queryOptions) {
            throw "No table selected";
        }
        const params:any[] = [];

        params.push(...this.applyWeightedConditions())

        let query = `SELECT ${queryOptions.selectColumns.join(",")} FROM `;

        if(queryOptions.subStatement) {
            let [subQuery, subParams] = this.applySubStatement();
            query += subQuery;
            params.push(...subParams);            
        } else {
            query += ` ${queryOptions.tableName} `;
        }

        const [joinString, joinParams] = this.applyJoins();

        query += joinString;
        params.push(...joinParams);

        
        if(queryOptions.queryConstraints.getWheres().length > 0) {
            query += ` WHERE ${(queryOptions.queryConstraints.applyWheres(params,[]))} `;
        }                
        queryOptions.params = params;

        if(typeof queryOptions.groupFields != "undefined" && queryOptions.groupFields.length > 0) {
            query += ` GROUP BY ${queryOptions.groupFields.join(",")} `;
        }

        if(queryOptions.ordering.length > 0) {
            query += " ORDER BY ";
            let orders = queryOptions.ordering.map((val)=>{
                return ` ${this.escape(val['field'])} ${val["direction"]} `;
            });
            query += orders.join(",");
        }        

        if(typeof queryOptions.limitAmount != "undefined") {
            query += ` LIMIT ${queryOptions.limitAmount} `;
        }

        if(typeof queryOptions.offsetAmount != "undefined") {
            query += ` OFFSET ${queryOptions.offsetAmount} `;
        }

        return query;
    }

    public copyConstraints(queryToCopy: iSQL): iSQL {
        this.queryOptions.queryConstraints.setWheres(queryToCopy.getConstraints().getWheres());
        return this;
    }

    public where(field : string, comparator : Comparator, value : any, escape : boolean = true) : iSQL {
        this.queryOptions.queryConstraints.where(this.escape(field),comparator,value,escape);
        return this;
    }
    
    public whereNull(field : string) : iSQL {
        this.queryOptions.queryConstraints.whereNull(this.escape(field));
        return this;
    }
    
    public whereNotNull(field : string) : iSQL {
        this.queryOptions.queryConstraints.whereNotNull(this.escape(field));
        return this;
    }
    
    public whereIn(field : string, subQuery : iSQL) : iSQL
    public whereIn(field : string, values : any[], escape : boolean) : iSQL
    public whereIn(field : string, values : iSQL | any[], escape : boolean = true) : iSQL {
        field = this.escape(field);
        if(Array.isArray(values)) {
            this.queryOptions.queryConstraints.whereIn(field,values,escape);                
        } else {
            if(values instanceof DBConnection) {
                values = values.getDBHandler() as MySQLDriver;
            }
            this.queryOptions.queryConstraints.whereIn(field,values);
        }        
        return this;
    }
    
    public whereNotIn(field : string, subQuery : iSQL) : iSQL
    public whereNotIn(field : string, values : any[], escape : boolean) : iSQL
    public whereNotIn(field : string, values : iSQL | any[], escape : boolean = true) : iSQL {
        field = this.escape(field);
        if(Array.isArray(values)) {
            this.queryOptions.queryConstraints.whereNotIn(field,values,escape);                
        } else {
            if(values instanceof DBConnection) {
                values = values.getDBHandler() as MySQLDriver;
            }
            this.queryOptions.queryConstraints.whereNotIn(field,values);
        }        
        return this;
    }

    public weightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean) : MySQLDriver
    public weightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean = true) : MySQLDriver {
        let weightedQuery = new QueryConstraints(false);
        weightedQuery.where(this.escape(field),comparator,value,escape);
        this.queryOptions.weightedConditions.push(new WeightedCondition(weightedQuery,weight,nonMatchWeight));
        return this;
    }
    
    public subWeightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight:number | WeightedCondition, escape : boolean = true) : WeightedCondition {
        let weightedQuery = new QueryConstraints(false);
        weightedQuery.where(this.escape(field),comparator,value,escape);
        return new WeightedCondition(weightedQuery,weight,nonMatchWeight);
    }

    public or() : MySQLDriver {
        this.queryOptions.queryConstraints.or();
        return this;
    }
    
    public and() : MySQLDriver {
        this.queryOptions.queryConstraints.and();
        return this;
    }
    
    public openBracket() : MySQLDriver {
        this.queryOptions.queryConstraints.openBracket();
        return this;
    }
    
    public closeBracket() : MySQLDriver {
        this.queryOptions.queryConstraints.closeBracket();
        return this;
    }


    public limit(limitAmount: number) : MySQLDriver {
        this.queryOptions.limitAmount = limitAmount;
        return this;
    }

    public offset(offsetAmount: number) : MySQLDriver {
        this.queryOptions.offsetAmount = offsetAmount;
        return this;
    }

    public order(field:string, direction: "ASC" | "DESC"): MySQLDriver {
        this.queryOptions.ordering.push({
            field: field,
            direction: direction
        });
        return this;
    }
    
    public group(groupFields:string[]): MySQLDriver {
        this.queryOptions.groupFields = groupFields;
        return this;
    }

    public async count(): Promise<number> {
        const sql = new MySQLDriver(this.configName, this.config);
        sql.table(this,"count_sql");
        sql.cols(["COUNT(*) num"]);
        const result = await sql.fetch<{num:number}>().catch(err=>{
            throw err;
        });
        if(!result || result.rows.length === 0) return 0;

        return result.rows[0].num;
    }

    public async paginate(perPage: number, page: number): Promise<iPagination> {
        const numberOfRecords = await this.count().catch(err=>{
            throw err;
        });
        this.limit(perPage);
        this.offset( perPage * (page - 1) );
        return {
            total_rows: numberOfRecords
        };
    }

    private addJoin(type: string, table : string | MySQLDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined):void {
        let tableName = "";
        let primaryKey: string | ((q:QueryConstraints)=>QueryConstraints) | undefined;
        let foreignKey: string | undefined;
        let params:any[] = [];
        if(typeof table == "string") {
            tableName = table;
            primaryKey = arg2;
            foreignKey = <string>arg3;
        } else {
            if(table instanceof DBConnection) {
                const selectColumns = table.getSelectColumns();
                table = table.getDBHandler() as MySQLDriver;
                table.cols(selectColumns);
            }
            tableName = "(" + table.generateSelect() + ") " + arg2 + " ";
            primaryKey = arg3;
            foreignKey = arg4;
            params = table.getParams();
        }
        const query = new QueryConstraints(false);
        if(primaryKey && typeof primaryKey != "string") {
            primaryKey(query);
        } else if(typeof primaryKey == "string") {
            query.on(primaryKey,"=",foreignKey);
            
        }
        this.queryOptions.joins.push({
            type: type,
            table: tableName,
            query: query,
            params: params
        });
    }

    public join(tableName : MySQLDriver, tableAlias : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : MySQLDriver
    public join(tableName : MySQLDriver, tableAlias : string, primaryKey : string, foreignKey : string) : MySQLDriver
    public join(tableName : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : MySQLDriver
    public join(tableName : string, primaryKey : string, foreignKey : string) : MySQLDriver
    public join(table : string | MySQLDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined) : MySQLDriver {
        this.addJoin("JOIN", table, arg2, arg3, arg4);
        return this;
    }
    
    public leftJoin(tableName : MySQLDriver, tableAlias : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : MySQLDriver
    public leftJoin(tableName : MySQLDriver, tableAlias : string, primaryKey : string, foreignKey : string) : MySQLDriver
    public leftJoin(tableName : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : MySQLDriver
    public leftJoin(tableName : string, primaryKey : string, foreignKey : string) : MySQLDriver
    public leftJoin(table : string | MySQLDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined) : MySQLDriver {
        this.addJoin("LEFT JOIN", table, arg2, arg3, arg4);
        return this;
    }

    public async fetch<TResult = any>() {
        this.queryOptions.type = "SELECT";
        const query = this.generateSelect();
        return await this.execute<TResult>(query).catch(err=>{
            throw err;
        });
    }

    public stream<TResult = any>(num : number, callback : (results:TResult[])=>Promise<boolean>): Promise<void> {
        return new Promise(async (resolve,reject)=>{
            const query = this.generateSelect();
            const shouldContinue = await this.triggerBeforeEvents(query);

            if(!shouldContinue) {
                return resolve();
            }

            const connection = await this.getConnection().catch(err=>{
                reject(err);
            });
            if(!connection) {
                return;
            }
            let results:TResult[] = [];

            connection.query(query, this.queryOptions.params)
                .on('error', (err)=>{
                    reject(err);
                })
                .on('result',async (result: mysql.RowDataPacket) => {
                    results.push(result as TResult);
                    if(results.length >= num) {
                        connection.pause();
                        const shouldContinue = await callback(results);
                        this.triggerAfterEvents(query, {
                            insert_id: 0,
                            rows_affected: 0,
                            rows_changed: 0,
                            rows: [...results]
                        });
                        results = [];
                        if(!shouldContinue) {
                            connection.destroy();
                            resolve();
                        } else {
                            connection.resume();
                        }
                    }
                })
                .on('end',async ()=>{
                    if(results.length > 0) {
                        await callback(results);
                        this.triggerAfterEvents(query, {
                            insert_id: 0,
                            rows_affected: 0,
                            rows_changed: 0,
                            rows: results
                        });
                    }
                    connection.release();
                    resolve();
                })
        });        
    }



    private multiInsert(columnValues: {[key:string]:any}[], escape: boolean) {
        let params:any[] = [];
        let multiInsertValues:any[] = [];
        columnValues.forEach((insertRecord:{[key:string]:any})=>{
            if(escape) {
                for(let key in insertRecord) {
                    params.push(insertRecord[key]);
                    insertRecord[key] = "?";
                }
            }
            multiInsertValues.push(insertRecord);
        });
        this.queryOptions.multiInsertValues = multiInsertValues;
        this.queryOptions.params = params;
    }
    private singleInsert(columnValues:{[key:string]:any}, escape: boolean) {
        let params:any[] = [];
        if(escape) {
            for(let key in columnValues) {
                params.push(columnValues[key]);
                columnValues[key] = "?";
            }
        }
        this.queryOptions.params = params;
        this.queryOptions.insertValues = columnValues;
    }
    public insert(columnValues : {[key:string]:any}[], escape : boolean) : MySQLDriver
    public insert(columnValues : {[key:string]:any}, escape : boolean) : MySQLDriver
    public insert(columnValues : {[key:string]:any}[] | {[key:string]:any}, escape : boolean = true) : MySQLDriver {            
        this.queryOptions.type = "INSERT";
        if(Array.isArray(columnValues)) {
            this.multiInsert(columnValues, escape);
        } else {
           this.singleInsert(columnValues, escape);
        }
        
        return this;
    }


    private generateMultiInsert(): string {
        if(!this.queryOptions.multiInsertValues) {
            return "";
        }
        let columns = Object.keys(this.queryOptions.multiInsertValues[0]).map(this.escape);
        let insert = columns.join(",") + ") VALUES ";
        insert += this.queryOptions.multiInsertValues.map((insertRow:object)=>{
            return `(${Object.values(insertRow).join(",")})`;
        }).join(',');
        return insert;
    }

    private generateSingleInsert(): string {
        if(!this.queryOptions.insertValues) {
            return "";
        }
        let columns = Object.keys(this.queryOptions.insertValues).map(this.escape);
        let insert = columns.join(",") + ") VALUES ";
        insert += `(${Object.values(this.queryOptions.insertValues).join(",")})`;
        return insert;
    }

    public generateInsert() : string {
        let query = `INSERT INTO ${this.queryOptions.tableName} (`;
        if(typeof this.queryOptions.multiInsertValues == "undefined") {
            query += this.generateSingleInsert();
        } else {
            query += this.generateMultiInsert();
        }
        return query;
    }


    public update(columnValues : {[key:string]:any}, escape : boolean = true) : MySQLDriver {
        this.queryOptions.type = "UPDATE";
        let params:any[] = [];
        if(escape) {
            for(let key in columnValues) {
                params.push(columnValues[key]);
                columnValues[key] = "?";
            }
        }
        this.queryOptions.params = params;
        this.queryOptions.updateValues = columnValues;
        return this;
    }

    public generateUpdate() : string {
        let query = `UPDATE ${this.queryOptions.tableName} SET `;
        for(let key in this.queryOptions.updateValues) {
            query += ` ${this.escape(key)} = ${this.queryOptions.updateValues[key]}, `;
        }
        query = (query.substring(0,query.length - 2)) + " ";

        if(this.queryOptions.queryConstraints.getWheres().length > 0) {
            query += " WHERE " + (this.queryOptions.queryConstraints.applyWheres(this.queryOptions.params ?? [],[])) + " ";
        }

        return query;
    }

    public async save() : Promise<SQLResult<any>> {
        switch(this.queryOptions.type) {
            case "INSERT":
                return await this.execute(this.generateInsert()).catch(err=>{
                    throw err;
                });
            case "UPDATE":
                return await this.execute(this.generateUpdate()).catch(err=>{
                    throw err;
                });
        }

        throw "Query is not UPDATE or INSERT";

    }




    public async delete(): Promise<SQLResult<any>> {
        this.queryOptions.type = "DELETE";
        return await this.execute(this.generateDelete()).catch(err=>{
            throw err;
        });
    }


    public generateDelete() : string {
        let query = `DELETE FROM ${this.queryOptions.tableName} `;
        this.queryOptions.params = [];
        if(this.queryOptions.queryConstraints.getWheres().length > 0) {
            query += ` WHERE ${(this.queryOptions.queryConstraints.applyWheres(this.queryOptions.params,[]))} `;
        }
        return query;
    }


    

    private async triggerBeforeEvents(query:string) {
        const beforeEvents = this.events?.get("before")?.get(this.queryOptions.type);
        let shouldContinue = true;
        if(this.eventsSuppressed) {
            return true;
        }
        if(beforeEvents && beforeEvents.length > 0) {
            for(const i in beforeEvents) {
                const newQuery = this.newQuery();
                newQuery.queryOptions = {...this.queryOptions};
                newQuery.suppressEvents(true);
                let hasReturnedFalse = await beforeEvents[i]({
                    "type": this.queryOptions.type,
                    "table": this.queryOptions.tableName ?? "",
                    "result": null,
                    "query": query,
                    "connection": newQuery
                });
                if(!hasReturnedFalse) {
                    shouldContinue = false;
                }
            }
        }
        return shouldContinue;
    }

    private triggerAfterEvents(query:string, result:SQLResult<any>) {
        const afterEvents = this.events?.get("after")?.get(this.queryOptions.type);
        if(this.eventsSuppressed) {
            return;
        }
        if(afterEvents && afterEvents.length > 0) {
            afterEvents.forEach((e)=>{
                const newQuery = this.newQuery();
                newQuery.queryOptions = {...this.queryOptions};
                newQuery.suppressEvents(true);
                e({
                    type: this.queryOptions.type,
                    result: result,
                    query: query,
                    table: this.queryOptions.tableName ?? "",
                    connection: newQuery
                });
            });
        }
    }



    public execute<TResult>(query : string): Promise<SQLResult<TResult>> {
        return new Promise(async (resolve,reject)=>{

            const shouldContinue = await this.triggerBeforeEvents(query);
            if(!shouldContinue) {
                return resolve(new SQLResult());
            }

            const connection = await this.getConnection().catch(err=>{
                reject(err);
            });
            if(!connection) {
                return;
            }

            connection.query(query,this.queryOptions.params,(error,results,fields)=>{
                let result = new SQLResult<TResult>();

                if(!this.transactionConnection) {
                    connection.release();
                }
                
                if(error !== null) {
                    return reject(error);
                }
                let resultType = results.constructor.name;
                if(!Array.isArray(results)) {
                    result.rows_affected = results.affectedRows;
                    result.rows_changed = results.changedRows ?? 0;
                    result.insert_id = results.insertId;
                } else {
                    result.rows = results as TResult[];
                }
                
                this.triggerAfterEvents(query, result);

                return resolve(result);
            });
            
        });
    }


}