import ConnectionConfig from "./types/ConnectionConfig";
import MySQLDriver from "./drivers/MySQL/MySQLDriver";
import PostgresDriver from "./drivers/Postgres/PostgresDriver";
import iSQL from "./interfaces/iSQL";
import CRUDOperation from "./types/CRUDOperation";
import Event from "./types/Event";
import DBConnection from "./classes/DBConnection";
import pSQL from "./interfaces/pSQL";

export default class Factory {
    private static instance: Factory | undefined;

    private config:Map<string, ConnectionConfig> = new Map();

    private configEvents:Map<
        string, Map<
            "before" | "after", Map<
                CRUDOperation, ((e:Event)=>Promise<boolean>)[]
            >
        >
    > = new Map();

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

    private createDriver(configKey: string) {
        const config = this.getConnectionConfig(configKey);
        if(!config) {
            return null;
        }

        let handler: iSQL | null = null;
        switch(config.type) {
            case "MySQL":
                handler = new MySQLDriver(configKey, config);
                break;
            case "Postgres":
                handler = new PostgresDriver(configKey, config);
                break;
        }

        const events = this.configEvents.get(configKey);
        if(events) {
            handler?.addEvents(events);
        }
        return handler;
    }

    public generateConnection(configKey : string): pSQL | null {               
        const handler = this.createDriver(configKey);
        if(!handler) return null;
        const connection = new DBConnection(handler);
        return connection;
    }

    public async addConfig(name:string,config:ConnectionConfig) {
        if(this.config.has(name)) {
            await this.removeConfig(name);
        }
        this.config.set(name, config);
        this.configEvents.set(name, new Map([
            ["after", new Map([
                ["SELECT", []],
                ["DELETE", []],
                ["INSERT", []],
                ["UPDATE", []],
            ])],
            ["before", new Map([
                ["SELECT", []],
                ["DELETE", []],
                ["INSERT", []],
                ["UPDATE", []],
            ])]            
        ]));
    }

    public async removeConfig(name:string) {
        const driver = this.createDriver(name);
        if(driver) {
            await driver.closePool(name);
        }
        this.config.delete(name);
        this.configEvents.delete(name);
        return;
    }

    public addConfigEvent(name: string, when: "before" | "after", eventType: CRUDOperation, event:(e:Event)=>Promise<boolean>) {
        const events = this.configEvents.get(name)?.get(when);
        events?.get(eventType)?.push(event);
    }
}