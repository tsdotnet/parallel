/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 * Originally based upon Parallel.js: https://github.com/adambom/parallel.js/blob/master/lib/parallel.js
 */
import { ArrayPromise, PromiseBase, PromiseCollection, TSDNPromise } from '@tsdotnet/promises';
import { type WorkerLike } from '@tsdotnet/threading';
export interface ParallelOptions {
    evalPath?: string | undefined;
    maxConcurrency?: number;
    allowSynchronous?: boolean;
    env?: any;
    envNamespace?: string;
}
export type RequireType = string | Function | {
    name?: string;
    fn: Function;
};
export declare class Parallel {
    readonly options: ParallelOptions;
    protected readonly _requiredScripts: string[];
    protected readonly _requiredFunctions: {
        name?: string;
        fn: Function;
    }[];
    constructor(options?: ParallelOptions);
    static get isSupported(): boolean;
    static maxConcurrency(max: number): Parallel;
    static options(options?: ParallelOptions): Parallel;
    static require(...required: RequireType[]): Parallel;
    static requireThese(required: RequireType[]): Parallel;
    static startNew<T, U>(data: T, task: (data: T) => U, env?: unknown): PromiseBase<U>;
    static map<T, U>(data: T[], task: (data: T) => U, env?: unknown): ArrayPromise<U>;
    require(...required: RequireType[]): this;
    requireThese(required: RequireType[]): this;
    startNew<T, U>(data: T, task: (data: T) => U, env?: unknown): TSDNPromise<U>;
    startLocal<T, U>(data: T, task: (data: T) => U): TSDNPromise<U>;
    pipe<T, U>(data: T[], task: (data: T) => U, env?: unknown): PromiseCollection<U>;
    map<T, U>(data: T[], task: (data: T) => U, env?: unknown): ArrayPromise<U>;
    protected _getWorkerSource(task: Function | string, env?: unknown): string;
    protected _spawnWorker(task: Function | string, env?: unknown): WorkerLike | undefined;
    private ensureClampedMaxConcurrency;
}
export default Parallel;
