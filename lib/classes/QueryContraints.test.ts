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
    })
})