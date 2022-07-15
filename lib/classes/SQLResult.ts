export default class SQLResult<TResult> {
    public insert_id: number = 0;
    public rows_affected: number = 0;
    public rows_changed: number = 0;
    public rows: TResult[] = [];
}