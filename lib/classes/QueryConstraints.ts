import iSQL from '../interfaces/iSQL';
import Comparator from '../types/Comparator';
type whereDetails = {
    type: "where" | "logic" | "bracket"
    func?: (...args:any[])=>whereDetails
    args?: any[]
    field?: string
    comparator?: string
    params?: any[]
    value?: any
    escape?: boolean
    namedParam?: string
    paramNames?: string[]
}

export default class QueryConstraints {

    private wheres : whereDetails[] = [];
    private namedParams: boolean;
    private namedParamNum: number = 0;
    private namedParamPrefix: string = "param";
    private namedParamSymbol: string = '@';

    constructor(namedParams: boolean) {
        this.namedParams = namedParams;
    }

    public getParamNum() {
        return this.namedParamNum;
    }
    
    public increaseParamNum(num:number) {
        this.namedParamNum += num;
    }

    public setParamNum(num:number) {
        this.namedParamNum = num;
    }

    public setPrefix(prefix:string) {
        this.namedParamPrefix = prefix;
    }

    public setParamSymbol(symbol:string) {
        this.namedParamSymbol = symbol;
    }

    public getWheres() {
        return this.wheres;
    }
    
    public where(field : string, comparator : Comparator, value : any, escape : boolean = true) : QueryConstraints {
        
        this.wheres.push({
            type: "where",
            func: (field : string, comparator : Comparator, value : any, escape : boolean = true)=>{
                var details:whereDetails = {
                    type: "where",
                    field: field,
                    comparator: comparator,
                    value: value,
                    escape: escape
                };
                if(escape) {
                    details['namedParam'] = this.namedParamPrefix + (this.namedParamNum++).toString();
                }
                return details;
            },
            args: [
                field,
                comparator,
                value,
                escape
            ]
        });
        return this;
    }
    
    public on(field : string, comparator : Comparator, value : any, escape : boolean = false) : QueryConstraints {
        return this.where(field, comparator, value, escape);
    }
    
    public whereNull(field : string) : QueryConstraints {
        this.wheres.push({
            type: "where",
            func: (field:string)=>{
                return {
                    type: "where",
                    field: field,
                    comparator: "",
                    value: "IS NULL",
                    escape: false
                };
            },
            args:[field]
        });
        return this;
    }

    public onNull = this.whereNull;
    
    public whereNotNull(field : string) : QueryConstraints {
        this.wheres.push({
            type: "where",
            func: (field:string)=>{
                return {
                    type: "where",
                    field: field,
                    comparator: "",
                    value: "IS NOT NULL",
                    escape: false
                };
            },
            args:[field]
        });
        return this;
    }

    public onNotNull = this.whereNotNull;

    private generateWhereInFunc(type: "IN" | "NOT IN"): ((...args: any[]) => whereDetails) | undefined {
        return (field:string, values: iSQL | any[], escape:boolean=true)=>{
            var valueString : string;
            var params:any[] = [];
            var paramPrefixes:any[] = [];
            if(Array.isArray(values)) {
                if(!escape) {
                    valueString = ` (${values.join(",")}) `;
                } else {
                    valueString = ` (${values.map(()=>{
                        if(this.namedParams) {
                            var namedParam = this.namedParamPrefix + (this.namedParamNum++).toString();
                            paramPrefixes.push(namedParam);
                            return this.namedParamSymbol + namedParam;
                        } else {
                            return "?";
                        }                    
                    }).join(",")}) `;
                    params = values;
                }
            } else {
                values.increaseParamNum(this.getParamNum()-1);
                let startParamNum = values.getParamNum();
                valueString = " (" + values.generateSelect() + ") ";
                let paramDif = values.getParamNum() - startParamNum;
                this.increaseParamNum(paramDif);
                params = values.getParams();
                paramPrefixes = values.getParamNames();
            }
            return {
                type: "where",
                field: field,
                comparator: type,
                value: valueString,
                escape: false,
                params: params,
                paramNames: paramPrefixes
            };
        };
    }

    public whereIn(field : string, subQuery : iSQL) : QueryConstraints
    public whereIn(field : string, values : any[], escape : boolean) : QueryConstraints
    public whereIn(field : string, values : iSQL | any[], escape : boolean = true) : QueryConstraints {
        this.wheres.push({
            type: "where",
            func: this.generateWhereInFunc("IN"),
            args: [
                field,
                values,
                escape
            ]
        });
        return this;
    }

    public whereNotIn(field : string, subQuery : iSQL) : QueryConstraints
    public whereNotIn(field : string, values : any[], escape : boolean) : QueryConstraints
    public whereNotIn(field : string, values : iSQL | any[], escape : boolean = true) : QueryConstraints {
        this.wheres.push({
            type: "where",
            func: this.generateWhereInFunc("NOT IN"),
            args: [
                field,
                values,
                escape
            ]
        });
        return this;
    }

    public onIn = this.whereIn;
    
    public or() : QueryConstraints {
        this.wheres.push({
            type: "logic",
            value: "or"
        });
        return this;
    }
    
    public and() : QueryConstraints {
        this.wheres.push({
            type: "logic",
            value: "and"
        });
        return this;
    }
    
    public openBracket() : QueryConstraints {
        this.wheres.push({
            type: "bracket",
            value: "("
        });
        return this;
    }
    
    public closeBracket() : QueryConstraints {
        this.wheres.push({
            type: "bracket",
            value: ")"
        });
        return this;
    }

    public applyWheres(params : any[], paramNames: any[]) : string {
        var whereString = " ";
        if(this.wheres.length == 0) {
            return whereString;
        }
        var first = true;
        var logic = "and";
        this.wheres.forEach((where,i)=> {
            switch(where.type) {
                case "where":
                    if(!where.func || !where.args) return;
                    let whereDetails = where.func(...where.args);
                    if(!first && this.wheres[i-1]['type'] !== 'bracket') {
                        whereString += ` ${logic.toUpperCase()} `;
                    }
                    first = false;
                    whereString += ` ${whereDetails.field} ${whereDetails.comparator} `;
                    if(whereDetails.escape) {
                        if(this.namedParams) {
                            whereString += ` ${this.namedParamSymbol}${whereDetails.namedParam} `;
                            paramNames.push(whereDetails.namedParam);
                        } else {
                            whereString += " ? ";
                        }                        
                        params.push(whereDetails.value);
                    } else {
                        whereString += ` ${whereDetails.value} `;
                    }
                    if("params" in whereDetails && whereDetails.params) {
                        whereDetails.params.forEach((whereParam:any)=>{
                            params.push(whereParam);
                        });
                        if(this.namedParams && whereDetails.paramNames) {
                            whereDetails.paramNames.forEach((paramName:any)=>{
                                paramNames.push(paramName);
                            });
                        }
                    }
                    break;
                case "logic":
                    logic = where.value;
                    break;
                case "bracket":
                    if(where.value == '(' && !first) {
                        whereString += ` ${logic.toUpperCase()} `;
                    }
                    whereString += ` ${where.value} `;
                    break;
            }
        });
        return whereString;
    }
}