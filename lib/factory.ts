import ConnectionConfig from "lib/types/ConnectionConfig";
import MySQLDriver from "./drivers/MySQL/MySQLDriver";
import iSQL from "./interfaces/iSQL";
import CRUDOperation from "./types/CRUDOperation";
import Event from "./types/Event";

export default class Factory {
    private static instance: Factory | undefined;

    private config:{[key:string]: ConnectionConfig} = {};

    private configEvents:Map<string, Map<CRUDOperation, ((e:Event)=>void)[]>> = new Map();

    private constructor() {

    }

    public static getInstance() {
        if(!Factory.instance) {
            Factory.instance = new Factory;
        }
        return Factory.instance;
    }

    private getConnectionConfig(configKey: keyof typeof this.config): ConnectionConfig | null {
        
        if(!(configKey in this.config)) {
            return null
        }
        var config = this.config[configKey];
        
        return config
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

    public addConfig(name:string,config:ConnectionConfig) {
        this.config[name] = config;
        this.configEvents.set(name, new Map([
            ["SELECT", []],
            ["DELETE", []],
            ["INSERT", []],
            ["UPDATE", []],
        ]));
    }

    public addConfigEvent(name: string, eventType: CRUDOperation, event:(e:Event)=>void) {
        const events = this.configEvents.get(name);
        events?.get(eventType)?.push(event);
    }
}