import pSQL from "./lib/interfaces/pSQL";
import Factory from "./lib/factory";
import ConnectionConfig from "./lib/types/ConnectionConfig";
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