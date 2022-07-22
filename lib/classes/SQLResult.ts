export default class SQLResult<TResult> {
    public insert_id = 0;
    public rows_affected = 0;
    public rows_changed = 0;
    public rows: TResult[] = [];
}