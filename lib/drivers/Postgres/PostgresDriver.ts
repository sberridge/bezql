import ConnectionConfig from "./../../types/ConnectionConfig";
import QueryOptions from "./classes/QueryOptions";
import CRUDOperation from "./../../types/CRUDOperation";
import Event from "./../../types/Event";
import QueryConstraints from "./../../classes/QueryConstraints";
import * as pg from 'pg';
import WeightedCondition from "./../../classes/WeightedCondition";
import Comparator from "./../../types/Comparator";
import iSQL from "./../../interfaces/iSQL";
import SQLResult from "./../../classes/SQLResult";
import reservedWords from "./reservedWords";
import iPagination from "./../../interfaces/iPagination";

const  QueryStream = require('pg-query-stream');

export default class PostgresDriver implements iSQL {

    private transactionConnection: pg.PoolClient | undefined;
    private queryOptions: QueryOptions;
    private config:ConnectionConfig;
    private configName:string;
    private events: Map<
            "before" | "after", Map<
                CRUDOperation, ((e:Event)=>Promise<boolean>)[]
            >
        > | undefined;

    private eventsSuppressed = false;
    private static pools: Map<string, pg.Pool> = new Map();

    constructor(configName: string, config:ConnectionConfig) {
        this.config = config;
        this.configName = configName;
        const constraints = new QueryConstraints(true);
        constraints.setParamSymbol("$");
        constraints.setPrefix("");
        constraints.increaseParamNum(1);
        this.queryOptions = new QueryOptions(constraints);
    }

    private connect() {
        let pool = PostgresDriver.pools.get(this.configName);
        if(!pool) {
            let config:pg.PoolConfig = {
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                port: this.config.port
            };
            pool = new pg.Pool(config);
            PostgresDriver.pools.set(this.configName, pool);
        }
        return pool;
    }

    private getConnection(): Promise<pg.PoolClient> {
        return new Promise((resolve,reject)=>{
            if(this.transactionConnection) {
                return resolve(this.transactionConnection);
            }
            const connection = this.connect();
            connection.connect((err,client)=>{
                if(err) {
                    return reject(err);
                }
                return resolve(client);
            });
        });
    }

    public closePool(key: string):Promise<void> {
        return new Promise((resolve,reject)=>{
            const connection = PostgresDriver.pools.get(key);
            if(connection) {
                connection.end(()=>{
                    PostgresDriver.pools.delete(key);
                    resolve();
                })
            } else {
                resolve();
            }
        });  
    }

    public beginTransaction(): Promise<boolean> {
        return new Promise(async (resolve,reject)=>{
            this.transactionConnection = await this.getConnection();
            this.transactionConnection.query("BEGIN", err=>{
                if(err) {
                    this.transactionConnection?.release();
                    return reject(err);
                }
                resolve(true);
            })
        })
    }

    public rollback(commitError?:Error | undefined): Promise<boolean> {
        return new Promise((resolve,reject)=>{
            if(typeof this.transactionConnection === "undefined") {
                return reject("No transaction in progress");
            }
            this.transactionConnection.query("ROLLBACK", (err)=>{
                if(err) {
                    return reject(err);
                }
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
            this.transactionConnection.query("COMMIT", (err)=>{
                if(err) {
                    return resolve(this.rollback(err));
                }
                this.transactionConnection?.release();
                resolve(true);
            });
        });
    }

    public addEvents(events: Map<
            "before" | "after", Map<
                CRUDOperation, ((e:Event)=>Promise<boolean>)[]
            >
        >): void {
        this.events = events;
    }

    public suppressEvents(suppress: boolean): iSQL {
        this.eventsSuppressed = suppress;
        return this;
    }

    public raw(query:string,params:any): Promise<SQLResult> {
        this.queryOptions.params = [];
        if(typeof params !== "undefined") {
            if(Array.isArray(params)){
                params.forEach((param)=>{
                    this.queryOptions.params?.push(param);
                });
            } else {
                throw new Error("Must pass an array containing param values when running Postgres query");
            }
        }
        return this.execute(query);

    }

    public newQuery() {
        const query = new PostgresDriver(this.configName, this.config);
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
                word = `"${word}"`;
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

    public getConstraints() {
        return this.queryOptions.queryConstraints;
    }

    public increaseParamNum(num: number) {
        this.queryOptions.queryConstraints.increaseParamNum(num);
    }

    public getParamNum(): number {
        return this.queryOptions.queryConstraints.getParamNum();
    }

    public setIncrementingField(field: string): PostgresDriver {
        this.queryOptions.incrementingField = this.escape(field);
        return this;
    }

    public table(tableName: PostgresDriver, tableAlias: string): PostgresDriver
    public table(tableName: string): PostgresDriver
    public table(tableName: string | PostgresDriver, tableAlias?: string): PostgresDriver {
        if(typeof tableName === "string") {
            this.queryOptions.tableName = this.escape(tableName);
        } else if(tableAlias) {
            this.queryOptions.subStatement = [tableName, tableAlias];
        }
        
        return this;
    }

    public cols(selectColumns : string[]) : PostgresDriver {
        this.queryOptions.selectColumns = selectColumns.map((col)=>{return this.escape.call(this,col)});       
        return this;
    }



    public generateConditional(ifThis:string,thenVal:string,elseVal:string):string {
        return `CASE WHEN ${ifThis} THEN ${thenVal} ELSE ${elseVal} END`;
    }

    private applyWeightedConditions() {
        let newParams:any[] = [];
        if(this.queryOptions.weightedConditions.length > 0) {
            var weightedConditionQueries = this.queryOptions.weightedConditions.map((condition:WeightedCondition)=>{
                condition.increaseParamNum(this.getParamNum() - 1);
                let startParamNum = condition.getParamNum();
                let query = condition.applyCondition(this, newParams, []);
                let diff = condition.getParamNum() - startParamNum;
                this.increaseParamNum(diff);
                return query;
            });
            this.queryOptions.selectColumns.push(`${weightedConditionQueries.join(' + ')} __condition_weight__`);
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
        let [substatement,alias] = this.queryOptions.subStatement;
        let startParamNum = substatement.getParamNum();
        let query = ` (${substatement.generateSelect()}) ${alias} `;
        let diff = substatement.getParamNum() - startParamNum;
        this.increaseParamNum(diff);
        return [query, substatement.getParams()];
    }

    private applyJoins(): [string, any[]] {
        let newParams:any[] = [];
        let joinStrings:string[] = [];
        this.queryOptions.joins.forEach((join : any)=>{
            let joinDetails = join.func(...join.args);
            joinDetails.params.forEach(function(param: any) {
                newParams.push(param);
            });
            joinDetails.query.increaseParamNum(this.getParamNum()-1);
            let startParamNum = joinDetails.query.getParamNum();
            joinStrings.push(` ${joinDetails.type}  ${joinDetails.table} ON ${(joinDetails.query.applyWheres(newParams,[]))} `);
            let diff = joinDetails.query.getParamNum() - startParamNum;
            this.increaseParamNum(diff);
        });
        return [joinStrings.join(" "), newParams];
    }

    public generateSelect() {
        
        const queryOptions = this.queryOptions;
        if(!queryOptions) {
            throw "No table selected";
        }
        const params:any[] = [];
        let query = "SELECT ";
        

        params.push(...this.applyWeightedConditions())

        query += queryOptions.selectColumns.join(",");

        query += " FROM ";

        if(queryOptions.subStatement) {
            let [subQuery, subParams] = this.applySubStatement();
            query += subQuery;
            params.push(...subParams)
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
            var orders = queryOptions.ordering.map((val)=>{
                return this.escape(val['field']) + " " + val["direction"];
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
            this.queryOptions.queryConstraints.whereNotIn(field,values);
        }        
        return this;
    }

    public weightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean) : PostgresDriver
    public weightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean = true) : PostgresDriver {
        let weightedQuery = new QueryConstraints(true);
        weightedQuery.setParamSymbol("$");
        weightedQuery.setPrefix("");
        weightedQuery.increaseParamNum(1);
        weightedQuery.where(this.escape(field),comparator,value,escape);
        this.queryOptions.weightedConditions.push(new WeightedCondition(weightedQuery,weight,nonMatchWeight));
        return this;
    }
    
    public subWeightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number | WeightedCondition, escape : boolean) : WeightedCondition
    public subWeightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight:number | WeightedCondition, escape : boolean = true) : WeightedCondition {
        let weightedQuery = new QueryConstraints(true);
        weightedQuery.setParamSymbol("$");
        weightedQuery.setPrefix("");
        weightedQuery.increaseParamNum(1);
        weightedQuery.where(this.escape(field),comparator,value,escape);
        return new WeightedCondition(weightedQuery,weight,nonMatchWeight);
    }

    public or() : PostgresDriver {
        this.queryOptions.queryConstraints.or();
        return this;
    }
    
    public and() : PostgresDriver {
        this.queryOptions.queryConstraints.and();
        return this;
    }
    
    public openBracket() : PostgresDriver {
        this.queryOptions.queryConstraints.openBracket();
        return this;
    }
    
    public closeBracket() : PostgresDriver {
        this.queryOptions.queryConstraints.closeBracket();
        return this;
    }


    public limit(limitAmount: number) : PostgresDriver {
        this.queryOptions.limitAmount = limitAmount;
        return this;
    }

    public offset(offsetAmount: number) : PostgresDriver {
        this.queryOptions.offsetAmount = offsetAmount;
        return this;
    }

    public order(field:string, direction: "ASC" | "DESC"): PostgresDriver {
        this.queryOptions.ordering.push({
            field: field,
            direction: direction
        });
        return this;
    }
    
    public group(groupFields:string[]): PostgresDriver {
        this.queryOptions.groupFields = groupFields;
        return this;
    }

    public async count(): Promise<number> {
        var sql = new PostgresDriver(this.configName, this.config);
        sql.table(this,"count_sql");
        sql.cols(["COUNT(*) num"]);
        const result = await sql.fetch().catch(err=>{
            throw err;
        });
        if(!result || result.rows.length === 0) return 0;

        return result.rows[0];
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

    private addJoin(type: string, table : string | PostgresDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined):void {
        
        this.queryOptions.joins.push({
            func: (type: string, table : string | PostgresDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined) => {
                let tableName = "";
                let primaryKey: string | ((q:QueryConstraints)=>QueryConstraints) | undefined;
                let foreignKey: string | undefined;
                let params: any[] = [];
                if(typeof table == "string") {
                    tableName = table;
                    primaryKey = arg2;
                    foreignKey = <string>arg3;
                } else {
                    table.increaseParamNum(this.getParamNum()-1);
                    let startParamNum = table.getParamNum();
                    tableName = "(" + table.generateSelect() + ") " + arg2 + " ";
                    let paramDif = table.getParamNum() - startParamNum;
                    this.increaseParamNum(paramDif);
                    primaryKey = arg3;
                    foreignKey = arg4;
                    params = table.getParams();
                }
                let query = new QueryConstraints(true);
                query.setParamSymbol("$");
                query.setPrefix("");
                query.increaseParamNum(1);
                if(primaryKey && typeof primaryKey != "string") {
                    primaryKey(query);
                } else if(typeof primaryKey == "string") {
                    query.on(primaryKey,"=",foreignKey);            
                }
                return {
                    type: type,
                    table: tableName,
                    query: query,
                    params: params
                };
            },
            args: [
                type,
                table,
                arg2,
                arg3,
                arg4
            ]
        });
    }

    public join(tableName : PostgresDriver, tableAlias : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : PostgresDriver
    public join(tableName : PostgresDriver, tableAlias : string, primaryKey : string, foreignKey : string) : PostgresDriver
    public join(tableName : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : PostgresDriver
    public join(tableName : string, primaryKey : string, foreignKey : string) : PostgresDriver
    public join(table : string | PostgresDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined) : PostgresDriver {
        this.addJoin("JOIN", table, arg2, arg3, arg4);
        return this;
    }
    
    public leftJoin(tableName : PostgresDriver, tableAlias : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : PostgresDriver
    public leftJoin(tableName : PostgresDriver, tableAlias : string, primaryKey : string, foreignKey : string) : PostgresDriver
    public leftJoin(tableName : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : PostgresDriver
    public leftJoin(tableName : string, primaryKey : string, foreignKey : string) : PostgresDriver
    public leftJoin(table : string | PostgresDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined) : PostgresDriver {
        this.addJoin("LEFT JOIN", table, arg2, arg3, arg4);
        return this;
    }

    public async fetch() {
        this.queryOptions.type = "SELECT";
        const query = this.generateSelect();
        return await this.execute(query).catch(err=>{
            throw err;
        });
    }

    public stream(num : number, callback : (results:any[])=>Promise<boolean>): Promise<void> {
        return new Promise(async (resolve,reject)=>{

            const queryString = this.generateSelect();
            const shouldContinue = await this.triggerBeforeEvents(queryString);

            if(!shouldContinue) {
                return resolve();
            }

            const connection = await this.getConnection().catch(err=>{
                reject(err);
            });
            if(!connection) return;
            var results:any[] = [];
            
            const query = new QueryStream(queryString, this.queryOptions.params);
            const stream = connection.query(query);
            let running = true;


            const handleStreamBuffer = async (results: any[]) => {
                let continueStream = true;
                if(!running && results.length > 0) {
                    await callback(results);
                    this.triggerAfterEvents(query, {
                        insert_id: 0,
                        rows_affected: 0,
                        rows_changed: 0,
                        rows: results
                    });
                } else if(results.length >= num) {
                    const resultsToSend = results.splice(0, num);
                    stream.pause();
                    continueStream = await callback(resultsToSend);

                    this.triggerAfterEvents(query, {
                        insert_id: 0,
                        rows_affected: 0,
                        rows_changed: 0,
                        rows: resultsToSend
                    })
                    if(continueStream) {
                        stream.resume();
                    } else {
                        stream.destroy();
                        stream.cursor.close();
                        connection.release();
                        this.queryOptions.queryConstraints.setParamNum(1);
                        resolve();
                    }
                }
            }

            stream.on("data",async (data:any)=>{
                results.push(data);
                await handleStreamBuffer(results);
            })
            .on("error", (err:any)=>{
                reject(err);
            })
            .on("end",async ()=>{
                connection.release();
                running = false;
                handleStreamBuffer(results);
                this.queryOptions.queryConstraints.setParamNum(1);
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
                    var num = params.push(insertRecord[key]);
                    var name = num.toString();
                    insertRecord[key] = "$" + name;
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
                var num = params.push(columnValues[key]);
                var name = num.toString();
                columnValues[key] = "$" + name;
            }
        }
        this.queryOptions.params = params;
        this.queryOptions.insertValues = columnValues;
    }
    public insert(columnValues : {[key:string]:any}[], escape : boolean) : PostgresDriver
    public insert(columnValues : {[key:string]:any}, escape : boolean) : PostgresDriver
    public insert(columnValues : {[key:string]:any}[] | {[key:string]:any}, escape : boolean = true) : PostgresDriver {            
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

        if(this.queryOptions.incrementingField) {
            query += ` returning ${this.queryOptions.incrementingField}`;
        }

        return query;
    }


    public update(columnValues : {[key:string]:any}, escape : boolean = true) : PostgresDriver {
        this.queryOptions.type = "UPDATE";
        let params:any[] = [];
        if(escape) {
            for(let key in columnValues) {
                var num = params.push(columnValues[key]);
                var name = num.toString();
                columnValues[key] = "$" + name;
            }
            this.queryOptions.queryConstraints.increaseParamNum(params.length);
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

    public async save() : Promise<SQLResult> {
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




    public async delete(): Promise<SQLResult> {
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
        if(this.eventsSuppressed) {
            return true;
        }
        let shouldContinue = true;
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

    private triggerAfterEvents(query:string, result:SQLResult) {
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



    public execute(query : string): Promise<SQLResult> {
        return new Promise(async (resolve,reject)=>{

            const shouldContinue = await this.triggerBeforeEvents(query);
            if(!shouldContinue) {
                return resolve(new SQLResult());
            }

            const connection = await this.getConnection().catch(err=>{
                reject(err);
            });

            if(!connection) return;

            connection.query(query,this.queryOptions.params ?? [],(error,results)=>{
                let result = new SQLResult();
                if(!this.transactionConnection) {
                    connection.release();
                }                
                if(error !== null) {
                    return reject(error);
                }
                
                if(results.command == "INSERT") {
                    result.rows_affected = results.rowCount;
                    result.rows_changed = results.rowCount;
                    if(this.queryOptions.incrementingField) {
                        result.insert_id = results.rows[0][results.fields[0].name]
                    }
                } else if(["UPDATE", "DELETE"].includes(results.command)) {
                    result.rows_affected = results.rowCount;
                    result.rows_changed = results.rowCount;
                } else {
                    result.rows = results.rows;
                }

                this.triggerAfterEvents(query, result);

                return resolve(result);
            });
            
        });
    }
}