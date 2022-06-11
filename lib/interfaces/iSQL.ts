import SQLResult from "../../lib/classes/SQLResult";
import pSQL from "./pSQL";

interface iSQL extends pSQL {

    /** MODULE PRIVATE */
    getParams(): any[]
    increaseParamNum(num:number):void
    getParamNum():number
    getParamNames() : any[]

    generateConditional(ifThis:string,thenVal:string,elseVal:string):string

    generateSelect(): string
    generateInsert():string
    generateUpdate():string
    generateDelete():string
    /** END MODULE PRIVATE */

}

export default iSQL;