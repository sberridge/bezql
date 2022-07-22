import MySQLDriver from "../drivers/MySQL/MySQLDriver";
import PostgresDriver from "../drivers/Postgres/PostgresDriver";
import iSQL from "../interfaces/iSQL";
import SupportedDatabase from "../types/SupportedDatabase";
import QueryConstraints from "./QueryConstraints";

const generateMockConnection = (type:SupportedDatabase):iSQL => {
    switch(type) {
        case "MySQL":
            return new MySQLDriver("test",{
                "database": "",
                "host": "",
                "password": "",
                "port": 0,
                "type": "MySQL",
                "user": ""
            });
        case "Postgres":
            return new PostgresDriver("test",{
                "database": "",
                "host": "",
                "password": "",
                "port": 0,
                "type": "Postgres",
                "user": ""
            });
    }
};

describe("QueryConstraints class managing query conditions", ()=>{
    it("Should instantiate with either named or unnamed parameters",()=>{
        const namedConstraints = new QueryConstraints(true);
        expect(namedConstraints).toBeInstanceOf(QueryConstraints);
        expect(namedConstraints["namedParams"]).toBeTruthy();
        
        const unnamedConstraints = new QueryConstraints(false);
        expect(unnamedConstraints).toBeInstanceOf(QueryConstraints);
        expect(unnamedConstraints["namedParams"]).toBeFalsy();
    });

    it("Should return the correct param num", ()=>{
        const constraints = new QueryConstraints(true);
        const paramNum = constraints.getParamNum();
        expect(paramNum).toEqual(constraints["namedParamNum"]);
    });

    it("Should increase the param num by the specified amount", ()=>{
        const constraints = new QueryConstraints(true);
        const originalNum = constraints.getParamNum();
        constraints.increaseParamNum(5);
        expect(constraints.getParamNum() - originalNum).toEqual(5);
        constraints.where("1","=",1,true);
        expect(constraints.applyWheres([],[])).toMatch(/param5/);
    });

    it("Should set the param prefix",()=>{
        const prefix = "MyParamPrefix";
        const constraints = new QueryConstraints(true);
        constraints.setPrefix(prefix);
        expect(constraints["namedParamPrefix"]).toEqual(prefix);
        constraints.where("1","=",1,true);
        expect(constraints.applyWheres([],[])).toMatch(/MyParamPrefix0/);
    });

    it("Should set the param symbol", ()=>{
        const symbol = "&";
        const constraints = new QueryConstraints(true);
        constraints.setParamSymbol(symbol);
        constraints.setPrefix("param");
        expect(constraints["namedParamSymbol"]).toEqual(symbol);
        constraints.where("1","=",1,true);
        expect(constraints.applyWheres([],[])).toMatch(/\&param0/);
    });

    it("Should generate a where query", ()=>{
        const params1:any[] = [];
        const constraints = new QueryConstraints(false);
        constraints.where("name", "=", 1, true);
        constraints.where("name", ">" , 2, false);
        expect(constraints.applyWheres(params1,[])).toMatch(/ +name +\= +\? +AND +name +\> +2 +/);
        expect(params1[0]).toEqual(1);

        const params2: any[] = [];
        const namedParams:any[] = [];
        const namedConstraints = new QueryConstraints(true);
        namedConstraints.where("name", "=", 1, true);
        expect(namedConstraints.applyWheres(params2,namedParams)).toMatch(/ +name +\= +\@param0 +/);
        expect(params2[0]).toEqual(1);
        expect(namedParams[0]).toEqual("param0");        
    });

    it("Should generate a where in query",()=>{
        const params1:any[] = [];
        const constraints = new QueryConstraints(false);
        constraints.whereIn("name", [1,2,3], true);
        constraints.whereIn("name", [1,2,3], false);
        expect(constraints.applyWheres(params1,[])).toMatch(/ +name +IN +\(\?,\?,\?\) +AND +name +IN +\(1,2,3\) +/);
        expect(params1[0]).toEqual(1);
        expect(params1[1]).toEqual(2);
        expect(params1[2]).toEqual(3);

        const params2:any[] = [];
        const namedParams:any[] = [];
        const namedConstraints = new QueryConstraints(true);
        namedConstraints.whereIn("name", [1,2,3], true);
        expect(namedConstraints.applyWheres(params2,namedParams)).toMatch(/ +name +IN +\(\@param0,\@param1,\@param2\) +/);
        expect(params2[0]).toEqual(1);
        expect(params2[1]).toEqual(2);
        expect(params2[2]).toEqual(3);
        
        expect(namedParams[0]).toEqual("param0");
        expect(namedParams[1]).toEqual("param1");
        expect(namedParams[2]).toEqual("param2");
    });

    it("Should generate a where in query using a sub query",()=>{
        const query = generateMockConnection("MySQL");
        const params:any[] = [];
        query.table("users");
        query.cols(["name"]);
        query.where("id", "=", 1, true);
        const constraints = new QueryConstraints(false);
        constraints.whereIn("name", query);
        expect(constraints.applyWheres(params,[])).toMatch(/ +name +IN +\(SELECT +name +FROM +users +WHERE +id +\= +\? +\) +/);
        expect(params[0]).toEqual(1);


        const postQuery = generateMockConnection("Postgres");
        const postParams:any[] = [];
        const postParamNames:any[] = [];
        postQuery.table("users");
        postQuery.cols(["name"]);
        postQuery.where("id", "=", 1, true);
        const postConstraints = new QueryConstraints(true);
        postConstraints.setPrefix("");
        postConstraints.increaseParamNum(1);
        postConstraints.whereIn("name", postQuery);
        expect(postConstraints.applyWheres(postParams,postParamNames)).toMatch(/ +name +IN +\(SELECT +name +FROM +users +WHERE +id +\= +\$1 +\) +/);
        expect(postParams[0]).toEqual(1);
    });
    
    it("Should generate a where not in query",()=>{
        const params1:any[] = [];
        const constraints = new QueryConstraints(false);
        constraints.whereNotIn("name", [1,2,3], true);
        constraints.whereNotIn("name", [1,2,3], false);
        expect(constraints.applyWheres(params1,[])).toMatch(/ +name +NOT +IN +\(\?,\?,\?\) +AND +name +NOT +IN +\(1,2,3\) +/);
        expect(params1[0]).toEqual(1);
        expect(params1[1]).toEqual(2);
        expect(params1[2]).toEqual(3);

        const params2:any[] = [];
        const namedParams:any[] = [];
        const namedConstraints = new QueryConstraints(true);
        namedConstraints.whereNotIn("name", [1,2,3], true);
        expect(namedConstraints.applyWheres(params2,namedParams)).toMatch(/ +name +NOT +IN +\(\@param0,\@param1,\@param2\) +/);
        expect(params2[0]).toEqual(1);
        expect(params2[1]).toEqual(2);
        expect(params2[2]).toEqual(3);
        
        expect(namedParams[0]).toEqual("param0");
        expect(namedParams[1]).toEqual("param1");
        expect(namedParams[2]).toEqual("param2");
    });

    it("Should change logic to OR then back to AND",()=>{
        const constraints = new QueryConstraints(false);
        constraints.where("1","=",1,true);
        constraints.or();
        constraints.where("2","=",2,true);
        constraints.where("3","=",3,true);
        constraints.and();
        constraints.where("4","=",4,true);

        expect(constraints.applyWheres([],[])).toMatch(/ +1 +\= +\? +OR +2 +\= +\? +OR +3 +\= +\? +AND +4 +\= +\? +/);
    });

    it("Should open and close brackets", ()=>{
        const constraints = new QueryConstraints(false);
        constraints.openBracket();
        constraints.openBracket();
        constraints.closeBracket();
        constraints.closeBracket();
        expect(constraints.applyWheres([],[])).toMatch(/ +\( +\( +\) +\) +/);
    });
});