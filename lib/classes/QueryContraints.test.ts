import QueryConstraints from "./QueryConstraints";


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
    });

    it("Should set the param prefix",()=>{
        const prefix = "MyParamPrefix";
        const constraints = new QueryConstraints(true);
        constraints.setPrefix(prefix);
        expect(constraints["namedParamPrefix"]).toEqual(prefix);
    });

    it("Should set the param symbol", ()=>{
        const symbol = "$";
        const constraints = new QueryConstraints(true);
        constraints.setParamSymbol(symbol);
        expect(constraints["namedParamSymbol"]).toEqual(symbol);
    });

    it("Should generate a where query", ()=>{
        const params1:any[] = [];
        const constraints = new QueryConstraints(false);
        constraints.where("name", "=", 1, true);
        constraints.where("name", ">" , 2, false);
        expect(constraints.applyWheres(params1,[])).toMatch(/ +name +\= +\? +AND +name +\> +2 +/);
        expect(params1[0]).toEqual(1)

        const params2: any[] = [];
        const namedParams:any[] = [];
        const namedConstraints = new QueryConstraints(true);
        namedConstraints.where("name", "=", 1, true);
        expect(namedConstraints.applyWheres(params2,namedParams)).toMatch(/ +name +\= +\@param0 +/);
        expect(params2[0]).toEqual(1)
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
})