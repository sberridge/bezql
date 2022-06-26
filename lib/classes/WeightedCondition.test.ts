import QueryConstraints from "./QueryConstraints";
import WeightedCondition from "./WeightedCondition";
import MySQLDriver from "../drivers/MySQL/MySQLDriver";
import PostgresDriver from "../drivers/Postgres/PostgresDriver";
import SupportedDatabase from "../types/SupportedDatabase";

const generateDriver = (type:SupportedDatabase) => {
    switch(type) {
        case "MySQL":
            return new MySQLDriver("test", {
                "database": "",
                "host": "",
                "password": "",
                "port": 3306,
                "type": "MySQL",
                "user": ""
            });
        case "Postgres":
            return new PostgresDriver("test", {
                "database": "",
                "host": "",
                "password": "",
                "port": 3306,
                "type": "Postgres",
                "user": ""
            });
    };
}

describe("WeightedCondition", () => {
    it("Should construct with query constraints, weight, and non match weight", ()=>{
        const condition = new WeightedCondition(new QueryConstraints(true), 5, 2);
        expect(condition).toBeInstanceOf(WeightedCondition);
    });
    
    it("Should construct with query constraints, weight, and sub weighted condition", ()=>{
        const subCondition = new WeightedCondition(new QueryConstraints(true), 5, 10);
        const condition = new WeightedCondition(new QueryConstraints(true), 5, subCondition);        
        expect(condition).toBeInstanceOf(WeightedCondition);
    });

    it("Should return the param number of the attached QueryContraints instance", () => {
        const condition = new WeightedCondition(new QueryConstraints(true), 5, 2);
        expect(condition.getParamNum()).toEqual(0);
    });
    
    it("Should increase the param number of the attached QueryContraints instance", () => {
        const condition = new WeightedCondition(new QueryConstraints(true), 5, 2);
        condition.increaseParamNum(2);
        expect(condition.getParamNum()).toEqual(2);
    });

    it("Should generate apply the conditions and fill parameters (MySQL)", ()=>{
        const driver = generateDriver("MySQL");
        const constraints = driver.getConstraints();
        constraints.where("field", "=", 1, true);
        const condition = new WeightedCondition(constraints, 5, 2);
        const params:any[] = [];
        const query = condition.applyCondition(driver, params, []);
        expect(query).toMatch(/if\( +field +\= +\? +, +5, +2\)/);
        expect(params).toContain(1);
    });
    
    it("Should apply the conditions and fill parameters (Postgres)", ()=>{
        const driver = generateDriver("Postgres");
        const constraints = driver.getConstraints();
        constraints.where("field", "=", 1, true);
        const condition = new WeightedCondition(constraints, 5, 2);
        const params:any[] = [];
        const query = condition.applyCondition(driver, params, []);
        expect(query).toMatch(/CASE +WHEN +field += +\$1 +THEN +5 +ELSE +2 +END/);
        expect(params).toContain(1);
    });

    it("Should apply the conditions and fill the parameters with a sub where (MySQL)", ()=>{
        const driver = generateDriver("MySQL");
        const subConstraints = new QueryConstraints(false);
        const constraints = driver.getConstraints();
        const params:any[] = [];

        constraints.where("field", "=", 1, true);

        subConstraints.where("field2", "=", 2, true);
        const subCondition = new WeightedCondition(subConstraints, 5, 0);
        const condition = new WeightedCondition(constraints, 10, subCondition);
        const query = condition.applyCondition(driver, params, []);
        expect(query).toMatch(/if\( +field +\= +\? +, +10, +if\( +field2 +\= +\? +, +5, +0\)\)/);
        expect(params).toHaveLength(2);
        expect(params[0]).toEqual(1)
        expect(params[1]).toEqual(2)
    });
    
    it("Should apply the conditions and fill the parameters with a sub where (Postgres)", ()=>{
        const driver = generateDriver("Postgres");
        
        const constraints = driver.getConstraints();
        const subConstraints = new QueryConstraints(true);
        subConstraints.setParamNum(constraints.getParamNum());
        subConstraints.setParamSymbol("$");
        subConstraints.setPrefix("");

        const params:any[] = [];

        constraints.where("field", "=", 1, true);

        subConstraints.where("field2", "=", 2, true);
        const subCondition = new WeightedCondition(subConstraints, 5, 0);
        const condition = new WeightedCondition(constraints, 10, subCondition);
        const query = condition.applyCondition(driver, params, []);
        expect(query).toMatch(/CASE +WHEN +field += +\$1 +THEN +10 +ELSE +CASE +WHEN +field2 +\= +\$2 +THEN +5 +ELSE +0 +END +END/);
        expect(params).toHaveLength(2);
        expect(params[0]).toEqual(1)
        expect(params[1]).toEqual(2)
    });
});