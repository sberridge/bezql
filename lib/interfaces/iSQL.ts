import Event from "./../types/Event";
import CRUDOperation from "./../types/CRUDOperation";
import pSQL from "./pSQL";
import QueryConstraints from "./../classes/QueryConstraints";

interface iSQL extends pSQL {

    /** MODULE PRIVATE */

    closePool(key: string) : Promise<void>

    getConstraints(): QueryConstraints;
    getParams(): any[]
    increaseParamNum(num:number):void
    getParamNum():number
    getParamNames() : any[]

    generateConditional(ifThis:string,thenVal:string,elseVal:string):string

    generateSelect(): string
    generateInsert():string
    generateUpdate():string
    generateDelete():string

    addEvents(events:Map<
            "before" | "after", Map<
                CRUDOperation, ((e:Event)=>void)[]
            >
        >):void

    /** END MODULE PRIVATE */

}

export default iSQL;