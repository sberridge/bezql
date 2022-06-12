import iSQL from "../../../interfaces/iSQL";
import QueryConstraints from "../../../classes/QueryConstraints";
import WeightedCondition from "../../../classes/WeightedCondition";
import PostgresDriver from "../PostgresDriver";

class QueryOptions {

    type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" = "SELECT";
    tableName?: string;
    subStatement?: [iSQL, string];
    incrementingField?: string;
    joins: {
        func: (type: string, table : string | PostgresDriver, arg2 : string | ((q: QueryConstraints)=>QueryConstraints), arg3 : string | ((q: QueryConstraints)=>QueryConstraints) | undefined, arg4 : string | undefined)=>{
            type: string,
            table: string,
            query: QueryConstraints,
            params: any[]
        }
        args: [
            string,
            string | PostgresDriver,
            string | ((q: QueryConstraints)=>QueryConstraints),
            string | ((q: QueryConstraints)=>QueryConstraints) | undefined,
            string | undefined
        ]
    }[] = [];
    params?: any[];

    selectColumns: string[] = ["*"];
    queryConstraints: QueryConstraints;

    weightedConditions:WeightedCondition[] = [];

    groupFields: string[] | undefined;
    ordering: {field:string, direction:"ASC" | "DESC"}[] = [];
    limitAmount: number | undefined;
    offsetAmount: number | undefined


    multiInsertValues? : {[key:string]:any}[];
    insertValues? : {[key:string]:any};

    updateValues? : {[key:string]:any};


    constructor(constraints:QueryConstraints) {
        this.queryConstraints = constraints;
    }
    
}

export default QueryOptions;