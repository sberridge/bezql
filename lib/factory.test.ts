import MySQLDriver from "./drivers/MySQL/MySQLDriver";
import PostgresDriver from "./drivers/Postgres/PostgresDriver";
import Factory from "./factory";
import ConnectionConfig from "./types/ConnectionConfig";
import CRUDOperation from "./types/CRUDOperation";
import SupportedDatabase from "./types/SupportedDatabase";

const config:ConnectionConfig = {
    "database": "db",
    "host": "localhost",
    "password": "",
    "port": 3306,
    "type": "MySQL",
    "user": "root"
};

const addTestConfig = (name:string = "test", type:SupportedDatabase = "MySQL") => {
    const factory = Factory.getInstance();
    const thisConfig:ConnectionConfig = {...config};
    thisConfig.type = type;
    factory.addConfig(name, thisConfig);
    return factory;
}
const cruds:CRUDOperation[] = ["SELECT", "INSERT", "UPDATE", "DELETE"];

describe("Factory for building SQL connections and query builders from configs", ()=>{
    it("Should return the Factory singleton instance",()=>{
        const factory = Factory.getInstance();
        expect(factory).toBeInstanceOf(Factory);
        expect(factory).toBe(Factory.getInstance());
    });

    it("Should add a config", ()=>{
        const factory = addTestConfig();
        const addedConfig = factory["config"].get("test");
        expect(addedConfig).toBeDefined();

        if(!addedConfig) return;

        for(const key in addedConfig) {
            expect(addedConfig[key as keyof ConnectionConfig]).toEqual(config[key as keyof ConnectionConfig])
        }
    });

    it("Should set up the event lists for an added config", ()=>{
        const factory = addTestConfig();
        const events = factory["configEvents"].get("test")?.get("before");
        expect(events).toBeDefined();
        expect(events).toBeInstanceOf(Map);
        
        (cruds).forEach((e)=>{
            expect(events?.has(e)).toBeTruthy();
        });
    });

    it("Should remove a config",async ()=>{
        const factory = addTestConfig("test2");
        await factory.removeConfig("test2");

        const addedConfig = factory["config"].get("test2");
        const addedConfigEvents = factory["configEvents"].get("test2");
        expect(addedConfig).toBeUndefined();
        expect(addedConfigEvents).toBeUndefined();
    });

    it("Should add event callbacks",()=>{
        const factory = addTestConfig("eventtest");

        cruds.forEach(c=>{
            factory.addConfigEvent("eventtest", "before", c, async (e)=>{return true;});
        });       

        const events = factory["configEvents"].get("eventtest");
        expect(events).toBeDefined();
        if(!events) return;

        cruds.forEach(c=>{
            expect(events.get("before")?.get(c)?.length).toEqual(1);
        });
    });

    it("Should generate a MySQL connection",()=>{
        const factory = addTestConfig("mysql_contest");
        const connection = factory.generateConnection("mysql_contest");
        if(!connection) return;
        expect(connection["dbHandler"]).toBeInstanceOf(MySQLDriver);
    })
    
    it("Should generate a Postgres connection",()=>{
        const factory = addTestConfig("post_contest", "Postgres");
        const connection = factory.generateConnection("post_contest");
        if(!connection) return;
        expect(connection["dbHandler"]).toBeInstanceOf(PostgresDriver);
    })
})