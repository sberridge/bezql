import iSQL from "../interfaces/iSQL";
import QueryConstraints from "./QueryConstraints";

export default class WeightedCondition {
    private query : QueryConstraints
    private weight: number
    private nonMatchWeight: number | undefined;
    private nonMatchSubCondition: WeightedCondition | undefined


    constructor(query:QueryConstraints,weight:number,nonMatchWeight:number | WeightedCondition)
    constructor(query:QueryConstraints,weight:number,NonMatch:WeightedCondition|number) {
        this.query = query;
        this.weight = weight;
        if(typeof NonMatch == "number") {
            this.nonMatchWeight = NonMatch;
        } else {
            this.nonMatchSubCondition = NonMatch;
        }
    }

    public getParamNum() {
        return this.query.getParamNum();
    }

    public increaseParamNum(num:number) {
        this.query.increaseParamNum(num);
    }

    public applyCondition(sql:iSQL,params:any[],paramNames:any[]):string {        
        var elseStr = "0";
        var whereStr = this.query.applyWheres(params,paramNames);
        if(typeof this.nonMatchWeight === 'number') {
            elseStr = this.nonMatchWeight.toString();
        } else if(this.nonMatchSubCondition) {
            this.nonMatchSubCondition.increaseParamNum(this.getParamNum() - 1);
            let startParamNum = this.nonMatchSubCondition.getParamNum();
            elseStr = this.nonMatchSubCondition.applyCondition(sql,params,paramNames);
            let diff = this.nonMatchSubCondition.getParamNum() - startParamNum;
            this.increaseParamNum(diff);
        }
        var conditionQuery = sql.generateConditional(whereStr, this.weight.toString(), elseStr);
        return conditionQuery;
    }
}