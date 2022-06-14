import Comparator from "../types/Comparator";
import SQLResult from "../classes/SQLResult";
import WeightedCondition from "../classes/WeightedCondition";
import QueryConstraints from "../classes/QueryConstraints";

interface pSQL {

    newQuery():pSQL

    table(tableName : pSQL, tableAlias : string) : pSQL
    cols(columns : string[]) : pSQL
    table(tableName : string) : pSQL

    suppressEvents(suppress:boolean): pSQL;

    setIncrementingField(field: string) : pSQL
    
    fetch(): Promise<SQLResult>
    stream(num : number, callback : (results:any[])=>Promise<boolean>): Promise<void>

    limit(limitAmount: number) : pSQL
    offset(offsetAmount: number) : pSQL

    where(field : string, comparator : Comparator, value : any, escape : boolean) : pSQL
        
    whereNull(field : string) : pSQL

    whereNotNull(field : string) : pSQL

    whereIn(field : string, subQuery : pSQL) : pSQL
    whereIn(field : string, values : any[], escape : boolean) : pSQL
    
    whereNotIn(field : string, subQuery : pSQL) : pSQL
    whereNotIn(field : string, values : any[], escape : boolean) : pSQL

    weightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : pSQL
    weightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number, escape : boolean) : pSQL
    
    subWeightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: WeightedCondition, escape : boolean) : WeightedCondition
    subWeightedWhere(field : string, comparator : Comparator, value : any, weight: number, nonMatchWeight: number, escape : boolean) : WeightedCondition

    copyConstraints(queryToCopy:pSQL): pSQL;

    or() : pSQL

    and() : pSQL

    openBracket() : pSQL
    closeBracket() : pSQL


    join(tableName : pSQL, tableAlias : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : pSQL
    join(tableName : pSQL, tableAlias : string, primaryKey : string, foreignKey : string) : pSQL
    join(tableName : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : pSQL
    join(tableName : string, primaryKey : string, foreignKey : string) : pSQL
    
    leftJoin(tableName : pSQL, tableAlias : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : pSQL
    leftJoin(tableName : pSQL, tableAlias : string, primaryKey : string, foreignKey : string) : pSQL
    leftJoin(tableName : string, queryFunc : (q: QueryConstraints) => QueryConstraints) : pSQL
    leftJoin(tableName : string, primaryKey : string, foreignKey : string) : pSQL

    order(field:string,direction: "ASC" | "DESC"): pSQL

    group(groupFields:string[]): pSQL



    insert(columnValues : {[key:string]:any}[], escape : boolean) : pSQL
    insert(columnValues : {[key:string]:any}, escape : boolean) : pSQL

    update(columnValues : {[key:string]:any}, escape : boolean) : pSQL
    save() : Promise<SQLResult>

    delete(): Promise<SQLResult>


}

export default pSQL;