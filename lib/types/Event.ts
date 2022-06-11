import SQLResult from "./../classes/SQLResult"
import CRUDOperation from "./CRUDOperation"

type Event = {
    type: CRUDOperation
    table: string
    query: string
    result: SQLResult
}

export default Event;