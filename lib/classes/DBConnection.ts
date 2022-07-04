import iPagination from "../interfaces/iPagination";
import Comparator from "../types/Comparator";
import pSQL from "../interfaces/pSQL";
import QueryConstraints from "./QueryConstraints";
import SQLResult from "./SQLResult";
import WeightedCondition from "./WeightedCondition";
import iSQL from "../interfaces/iSQL";

export default class DBConnection implements pSQL {
    private dbHandler:iSQL;
    private selectColumns: string[] = ["*"];

    public constructor(connection:iSQL) {
        this.dbHandler = connection;
    }

    public getDBHandler() {
        return this.dbHandler;
    }

    public beginTransaction(): Promise<boolean> {
        return this.dbHandler.beginTransaction();
    }

    public commit(): Promise<boolean> {
        return this.dbHandler.commit();
    }

    public rollback(): Promise<boolean> {
        return this.dbHandler.rollback();
    }

    public raw(query: string, params: any): Promise<SQLResult> {
        return this.dbHandler.raw(query, params);
    }

    public newQuery(): pSQL {
        return new DBConnection(this.dbHandler.newQuery() as iSQL);
    }

    public table(tableName: pSQL, tableAlias: string): pSQL;
    public table(tableName: string): pSQL;
    public table(tableName: pSQL | string, tableAlias?: string | undefined): pSQL {
        if(typeof tableName == "string") {
            this.dbHandler.table(tableName);
        } else if(typeof tableName !== "string" && typeof tableAlias === "string") {
            this.dbHandler.table(tableName, tableAlias);
        }
        
        return this;
    }

    public cols(columns: string[]): pSQL {
        this.selectColumns = columns;
        return this;
    }

    public addCol(column:string) : pSQL {
        this.selectColumns.push(column);
        return this;
    }
    
    public removeCol(column:string) : pSQL {
        if(this.selectColumns.indexOf(column) > -1) {
            this.selectColumns.splice(this.selectColumns.indexOf(column),1);
        }
        return this;
    }

    public removeCols(columns:string[]) : pSQL {
        columns.forEach((column)=>this.removeCol(column));
        return this;
    }
    
    public keepCols(columns:string[]) : pSQL {
        this.selectColumns = this.selectColumns.filter((column)=>{
            return columns.includes(column);
        });
        return this;
    }

    public suppressEvents(suppress: boolean): pSQL {
        this.dbHandler.suppressEvents(suppress);
        return this;
    }

    public setIncrementingField(field: string): pSQL {
        this.dbHandler.setIncrementingField(field);
        return this;
    }

    public fetch(): Promise<SQLResult> {        
        this.dbHandler.cols(this.selectColumns);
        return this.dbHandler.fetch();
    }

    public stream(num: number, callback: (results: any[]) => Promise<boolean>): Promise<void> {
        this.dbHandler.cols(this.selectColumns);
        return this.dbHandler.stream(num, callback);
    }

    public limit(limitAmount: number): pSQL {
        this.dbHandler.limit(limitAmount);
        return this;
    }

    public offset(offsetAmount: number): pSQL {
        this.dbHandler.offset(offsetAmount);
        return this;
    }

    public order(field: string, direction: "ASC" | "DESC"): pSQL {
        this.dbHandler.order(field, direction);
        return this;
    }

    public group(groupFields: string[]): pSQL {
        this.dbHandler.group(groupFields);
        return this;
    }

    public count(): Promise<number> {
        return this.dbHandler.count();
    }

    public paginate(perPage:number, page:number): Promise<iPagination> {
        return this.dbHandler.paginate(perPage, page);        
    }

    public where(field: string, comparator: Comparator, value: any, escape: boolean): pSQL {
        this.dbHandler.where(field, comparator, value, escape);
        return this;
    }

    public whereIn(field: string, subQuery: pSQL): pSQL;
    public whereIn(field: string, values: any[], escape: boolean): pSQL;
    public whereIn(field: string, values: pSQL | any[], escape: boolean = true): pSQL {
        if(Array.isArray(values)) {
            this.dbHandler.whereIn(field, values, escape);
        } else {
            this.dbHandler.whereIn(field, values);
        }
        return this;
    }

    public whereNotIn(field: string, subQuery: pSQL): pSQL
    public whereNotIn(field: string, values: any[], escape: boolean): pSQL
    public whereNotIn(field: string, values: pSQL | any[], escape: boolean = true): pSQL {
        if(Array.isArray(values)) {
            this.dbHandler.whereNotIn(field, values, escape);
        } else {
            this.dbHandler.whereNotIn(field, values);
        }
        return this;
    }

    public whereNull(field: string): pSQL {
        this.dbHandler.whereNull(field);
        return this;
    }

    public whereNotNull(field: string): pSQL {
        this.dbHandler.whereNotNull(field);
        return this;
    }

    public weightedWhere(field: string, comparator: Comparator, value: any, weight: number, nonMatchWeight: number | WeightedCondition, escape: boolean): pSQL
    public weightedWhere(field: string, comparator: Comparator, value: any, weight: number, nonMatchWeight: number | WeightedCondition, escape: boolean): pSQL {
        if(typeof nonMatchWeight === "number") {
            this.dbHandler.weightedWhere(field, comparator, value, weight, nonMatchWeight, escape);
        } else {
            this.dbHandler.weightedWhere(field, comparator, value, weight, nonMatchWeight, escape);
        }        
        return this;
    }

    public subWeightedWhere(field: string, comparator: Comparator, value: any, weight: number, nonMatchWeight: WeightedCondition, escape: boolean): WeightedCondition;
    public subWeightedWhere(field: string, comparator: Comparator, value: any, weight: number, nonMatchWeight: number, escape: boolean): WeightedCondition;
    public subWeightedWhere(field: string, comparator: Comparator, value: any, weight: number, nonMatchWeight: number | WeightedCondition, escape: boolean = true): WeightedCondition {
        if(typeof nonMatchWeight === "number") {
            return this.subWeightedWhere(field, comparator, value, weight, nonMatchWeight, escape);
        } else {
            return this.subWeightedWhere(field, comparator, value, weight, nonMatchWeight, escape);
        }        
    }

    public or(): pSQL {
        this.dbHandler.or();
        return this;
    }
    
    public and(): pSQL {
        this.dbHandler.and();
        return this;
    }
    
    public openBracket(): pSQL {
        this.dbHandler.openBracket();
        return this;
    }
    
    public closeBracket(): pSQL {
        this.dbHandler.closeBracket();
        return this;
    }

    public copyConstraints(queryToCopy: pSQL): pSQL {
        this.dbHandler.copyConstraints(queryToCopy);
        return this;
    }

    public join(tableName: pSQL, tableAlias: string, queryFunc: (q: QueryConstraints) => QueryConstraints): pSQL;
    public join(tableName: pSQL, tableAlias: string, primaryKey: string, foreignKey: string): pSQL;
    public join(tableName: string, queryFunc: (q: QueryConstraints) => QueryConstraints): pSQL;
    public join(tableName: string, primaryKey: string, foreignKey: string): pSQL;
    public join(tableName : string | pSQL, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined) : pSQL {
        if(typeof tableName !== "string" && typeof arg2 === "string" && typeof arg3 === "function") {
            this.dbHandler.join(tableName, arg2, arg3);
        } else if(typeof tableName !== "string" && typeof arg2 === "string" && typeof arg3 === "string" && typeof arg4 === "string") {
            this.dbHandler.join(tableName, arg2, arg3, arg4);
        } else if(typeof tableName === "string" && typeof arg2 === "function") {
            this.dbHandler.join(tableName,arg2);
        } else if(typeof tableName === "string" && typeof arg2 === "string" && typeof arg3 === "string") {
            this.dbHandler.join(tableName, arg2, arg3);
        }        
        return this;
    }

    public leftJoin(tableName: pSQL, tableAlias: string, queryFunc: (q: QueryConstraints) => QueryConstraints): pSQL;
    public leftJoin(tableName: pSQL, tableAlias: string, primaryKey: string, foreignKey: string): pSQL;
    public leftJoin(tableName: string, queryFunc: (q: QueryConstraints) => QueryConstraints): pSQL;
    public leftJoin(tableName: string, primaryKey: string, foreignKey: string): pSQL;
    public leftJoin(tableName : string | pSQL, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined = undefined, arg4 : string | undefined = undefined) : pSQL {
        if(typeof tableName !== "string" && typeof arg2 === "string" && typeof arg3 === "function") {
            this.dbHandler.leftJoin(tableName, arg2, arg3);
        } else if(typeof tableName !== "string" && typeof arg2 === "string" && typeof arg3 === "string" && typeof arg4 === "string") {
            this.dbHandler.leftJoin(tableName, arg2, arg3, arg4);
        } else if(typeof tableName === "string" && typeof arg2 === "function") {
            this.dbHandler.leftJoin(tableName,arg2);
        } else if(typeof tableName === "string" && typeof arg2 === "string" && typeof arg3 === "string") {
            this.dbHandler.leftJoin(tableName, arg2, arg3);
        }        
        return this;
    }

    public insert(columnValues: { [key: string]: any; }[], escape: boolean): pSQL;
    public insert(columnValues: { [key: string]: any; }, escape: boolean): pSQL;
    public insert(columnValues : {[key:string]:any}[] | {[key:string]:any}, escape : boolean = true) : pSQL {            
        this.dbHandler.insert(columnValues, escape);
        return this;
    }

    public update(columnValues: { [key: string]: any; }, escape: boolean): pSQL {
        this.dbHandler.update(columnValues, escape);
        return this;
    }

    public save(): Promise<SQLResult> {
        return this.dbHandler.save();
    }

    public delete(): Promise<SQLResult> {
        return this.dbHandler.delete();
    }
}