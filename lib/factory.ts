import ConnectionConfig from "lib/types/ConnectionConfig";
import MySQLDriver from "./drivers/MySQL/MySQLDriver";
import iSQL from "./interfaces/iSQL";

export default class Factory {
    private static instance: Factory | undefined;

    private config:{[key:string]: ConnectionConfig} = {};

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

        switch(config.type) {
            case "MySQL":
                return new MySQLDriver(configKey, config);
        }

        return null;
    }

    public addConfig(name:string,config:ConnectionConfig) {
        this.config[name] = config;
    }
}