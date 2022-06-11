import ConnectionConfig from "lib/types/ConnectionConfig";
import MySQLDriver from "./drivers/MySQL/MySQLDriver";
import iSQL from "./interfaces/iSQL";
import CRUDOperation from "./types/CRUDOperation";
import Event from "./types/Event";

export default class Factory {
    private static instance: Factory | undefined;

    private config:Map<string, ConnectionConfig> = new Map();

    private configEvents:Map<string, Map<CRUDOperation, ((e:Event)=>void)[]>> = new Map();

    private constructor() {

    }

    public static getInstance() {
        if(!Factory.instance) {
            Factory.instance = new Factory;
        }
        return Factory.instance;
    }

    private getConnectionConfig(configKey: string): ConnectionConfig | null {
        
        let config = this.config.get(configKey)
        if(!config) {
            return null;
        }
        return config;
    }

    public generateConnection(configKey : string): iSQL | null {
        const config = this.getConnectionConfig(configKey);
        if(!config) {
            return null;
        }

        let handler: iSQL | null = null;
        switch(config.type) {
            case "MySQL":
                handler = new MySQLDriver(configKey, config);
        }

        const events = this.configEvents.get(configKey);
        if(events) {
            handler?.addEvents(events);
        }       


        return handler;
    }

    public async addConfig(name:string,config:ConnectionConfig) {
        if(this.config.has(name)) {
            await this.removeConfig(name);
        }
        this.config.set(name, config);
        this.configEvents.set(name, new Map([
            ["SELECT", []],
            ["DELETE", []],
            ["INSERT", []],
            ["UPDATE", []],
        ]));
    }

    public async removeConfig(name:string) {
        const connection = this.generateConnection(name);
        if(connection) {
            await connection.closePool(name);
        }
        this.config.delete(name);
        return;
    }

    public addConfigEvent(name: string, eventType: CRUDOperation, event:(e:Event)=>void) {
        const events = this.configEvents.get(name);
        events?.get(eventType)?.push(event);
    }
}