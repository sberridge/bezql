import pSQL from "./lib/interfaces/pSQL";
import Factory from "./lib/factory";
import ConnectionConfig from "./lib/types/ConnectionConfig";
import CRUDOperation from "./lib/types/CRUDOperation";
import Event from "./lib/types/Event";
import SupportedDatabase from "./lib/types/SupportedDatabase";
import MySQLDriver from "./lib/drivers/MySQL/MySQLDriver";
import PostgresDriver from "./lib/drivers/Postgres/PostgresDriver";


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

export const removeConfig = async (name:string) => {
    await Factory.getInstance().removeConfig(name);
}

export const addEventListener = (configName: string, eventType: CRUDOperation, callback:(e:Event)=>void) => {
    Factory.getInstance().addConfigEvent(configName, eventType, callback);
}

export const addReservedWord = (dbType: SupportedDatabase, word: string) => {
    switch(dbType) {
        case "MySQL":
            MySQLDriver.addReservedWord(word);
            break;
        case "Postgres":
            PostgresDriver.addReservedWord(word);
            break;
    }
}