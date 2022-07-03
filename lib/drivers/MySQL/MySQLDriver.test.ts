import MySQLDriver from "./MySQLDriver";


describe("MySQL Driver", () => {
    it("Should instantiate with a MySQL config", () => {
        const driver = new MySQLDriver("test", {
            "database": "",
            "host": "",
            "password": "",
            "port": 3306,
            "type": "MySQL",
            "user": ""
        });
        expect(driver).toBeInstanceOf(MySQLDriver);
    });

    
});