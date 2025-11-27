import { billingLogger } from "../types/logger";
import { BillableMeta } from "../types/meta";
import { BillableOptions } from "../types/options";
import { BillingEvent } from "../types/billingEvent";
import { Providers } from "../types/providers";
export class BillableSDK {
    private apiKey?: string;
    private project?: string;
    private connected = false;
    private autoConnect: boolean;
    private logger = billingLogger;

    constructor(options?: BillableOptions) {
        this.apiKey = options?.apiKey;
        this.project = options?.project;
        this.autoConnect = options?.autoConnect ?? true;
        this.logger.info(`Billing SDK initialized for project: ${this.project || 'default'}`);
    }

    connect() {
        this.connected = true;
        this.logger.info('Connected to billing service');
    }

    disconnect() {
        this.connected = false;
        this.logger.info('Disconnected from billing service');
    }

    wrap<T extends (...args: any[]) => any>(
        fn: T,
        meta?: BillableMeta
    ): T {

        const self = this;

        return function (this: any, ...args: Parameters<T>): ReturnType<T> {
            // authentication check here
            // if (!self.connected && self.autoConnect) {
            //     self.logger.error(' Not connected — connecting automatically...');
            //     self.connect();
            // }

            const resourceName = meta?.resource || fn.name || 'anonymous';
            const start = Date.now();
            self.logger.billing(` [${resourceName}] Starting billable execution\n ${meta ?? {}}`);
            try {
                const result = fn.apply(this, args);
                const event: BillingEvent = {
                    provider: Providers.USER_DEFINED

                }
                self.logger.invoice()
                return result

            } catch (error) {
                const duration = Date.now() - start;
                self.logger.error(` [${resourceName}] Failed in ${duration}ms\n ${error}`);
                throw error;


            }
            //create the event and log billing info here



        } as T;
    }

    // TODO
    // wrapAsync<T extends (...args: any[]) => Promise<any>>(
    //     fn: T,
    //     meta?: BillableMeta
    // ): T {
    //     const self = this;

    //     return async function (this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    //         if (!self.connected && self.autoConnect) {
    //             self.logger.info('⚠️ Not connected — connecting automatically...');
    //             self.connect();
    //         }

    //         const resourceName = meta?.resource || fn.name || 'anonymous';
    //         self.logger.info(`💳 [${resourceName}] Starting async billable execution\n ${meta ?? {}}`);
    //         const start = Date.now();

    //         try {
    //             const result = await fn.apply(this, args);
    //             const duration = Date.now() - start;
    //             console.log(`✅ [${resourceName}] Success in ${duration}ms`);
    //             return result;
    //         } catch (error) {
    //             const duration = Date.now() - start;
    //             self.logger.error(`❌ [${resourceName}] Failed in ${duration}ms:\n ${error}`);
    //             throw error;
    //         }
    //     } as T;
    // }


    // billable(meta?: BillableMeta) {
    //     const self = this;

    //     return function (
    //         target: any,
    //         propertyKey: string,
    //         descriptor: PropertyDescriptor
    //     ) {
    //         const originalMethod = descriptor.value;
    //         const isAsync = originalMethod.constructor.name === 'AsyncFunction';

    //         descriptor.value = async function (this: any, ...args: any[]) {
    //             if (!self.connected && self.autoConnect) {
    //                 console.warn('⚠️ Not connected — connecting automatically...');
    //                 self.connect();
    //             }

    //             const resourceName = meta?.resource || propertyKey;
    //             console.log(`💳 [${resourceName}] Starting billable execution`, meta ?? {});
    //             const start = Date.now();

    //             try {
    //                 const result = isAsync
    //                     ? await originalMethod.apply(this, args)
    //                     : originalMethod.apply(this, args);
    //                 const duration = Date.now() - start;
    //                 console.log(`✅ [${resourceName}] Success in ${duration}ms`);
    //                 return result;
    //             } catch (error) {
    //                 const duration = Date.now() - start;
    //                 console.error(`❌ [${resourceName}] Failed in ${duration}ms`, error);
    //                 throw error;
    //             }
    //         };

    //         return descriptor;
    //     };
    // }
}
