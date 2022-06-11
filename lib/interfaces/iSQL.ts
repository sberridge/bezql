import Event from "./../types/Event";
import CRUDOperation from "./../types/CRUDOperation";
import pSQL from "./pSQL";

interface iSQL extends pSQL {

    /** MODULE PRIVATE */

    closePool(key: string) : Promise<void>

    getParams(): any[]
    increaseParamNum(num:number):void
    getParamNum():number
    getParamNames() : any[]

    generateConditional(ifThis:string,thenVal:string,elseVal:string):string

    generateSelect(): string
    generateInsert():string
    generateUpdate():string
    generateDelete():string

    addEvents(events:Map<CRUDOperation, ((e:Event)=>void)[]>):void

    /** END MODULE PRIVATE */

}

export default iSQL;