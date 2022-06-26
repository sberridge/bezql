import SQLResult from "./SQLResult";

describe("SQL Result", () => {
    it("Should have properties", () => {
        const result = new SQLResult();
        [
            "insert_id",
            "rows_affected",
            "rows_changed",
            "rows"
        ].forEach((prop)=>{
            expect(result).toHaveProperty(prop)
            switch(prop) {
                case "insert_id":
                case "rows_affected":
                case "rows_changed": 
                    expect(typeof result[prop]).toEqual("number");
                    break;
                case "rows":
                    expect(Array.isArray(result[prop])).toBeTruthy();
                    break;
            }
        })        
    });
});