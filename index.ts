import pSQL from "./lib/interfaces/pSQL";
import Factory from "./lib/factory";
import ConnectionConfig from "./lib/types/ConnectionConfig";
import CRUDOperation from "./lib/types/CRUDOperation";
import Event from "./lib/types/Event";
export const addConfig = (name:string, config:ConnectionConfig) => {
    Factory.getInstance().addConfig(name, config);
}
export const startQuery = (configName:string) => {
    const q = Factory.getInstance().generateConnection(configName);
    if(q) {        
        return q as pSQL;
    }
    return null;
}

export const addEventListener = (configName: string, eventType: CRUDOperation, callback:(e:Event)=>void) => {
    Factory.getInstance().addConfigEvent(configName, eventType, callback);
}