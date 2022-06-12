import SupportedDatabase from "./SupportedDatabase";

type ConnectionConfig = {
    "type": SupportedDatabase,
    "host": string,
    "port": number,
    "database": string,
    "user": string,
    "password": string
}

export default ConnectionConfig;