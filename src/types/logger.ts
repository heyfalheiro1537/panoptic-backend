
import pino from "pino";
import { transport } from "./transporter/mongoDB";

const customLevels = {
    charge: 34,
    billing: 35,
    quota: 37,
    token_usage: 38,
    invoice: 39,
}


export const billingLogger = pino({
    level: process.env.PINO_LOG_LEVEL || 'info',
    customLevels,
    transport
});


