import iSQL from "../../../interfaces/iSQL";
import QueryConstraints from "./QueryConstraints";
import WeightedCondition from "./WeightedCondition";

class QueryOptions {

    type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" = "SELECT";
    tableName?: string;
    subStatement?: [iSQL, string];
    joins: {
        type: string
        table: string
        params: any[]
        query: QueryConstraints
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