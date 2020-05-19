/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 * Originally based upon Parallel.js: https://github.com/adambom/parallel.js/blob/master/lib/parallel.js
 */
import { ArrayPromise, PromiseBase, PromiseCollection, TSDNPromise } from '@tsdotnet/promises';
import { WorkerLike } from '@tsdotnet/threading/dist/WorkerLike';
export interface ParallelOptions {
    /**
     * This is the path to the file eval.js.  This is required when running in node, and required for some browsers (IE 10) in order to work around cross-domain restrictions for web workers.  Defaults to the same location as parallel.js in node environments, and null in the browser.
     **/
    evalPath?: string;
    /**
     * The maximum number of permitted worker threads.  This will default to 4, or the number of CPUs on your computer if you're running node.
     **/
    maxConcurrency?: number;
    /**
     * If WebWorkers are not available, whether or not to fall back to synchronous processing using setTimeout.  Defaults to true.
     **/
    allowSynchronous?: boolean;
    env?: any;
    envNamespace?: string;
}
/**
 * A URL to a global script to into the worker or a function to serialize.
 */
export declare type RequireType = string | Function | {
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
    /**
     * Returns true if paralleling is supported.
     * @return {boolean}
     */
    static get isSupported(): boolean;
    /**
     * Creates a Parallel with the specified max concurrency.
     * @param {number} max
     * @return {Parallel}
     */
    static maxConcurrency(max: number): Parallel;
    /**
     * Returns a Parallel with the specified options.
     * @param {ParallelOptions} options
     * @return {Parallel}
     */
    static options(options?: ParallelOptions): Parallel;
    /**
     * Returns a parallel with the specified prerequisite requirements.
     * @param {RequireType} required
     * @return {Parallel}
     */
    static require(...required: RequireType[]): Parallel;
    /**
     * Returns a parallel with the specified prerequisite requirements.
     * @param {RequireType} required
     * @return {Parallel}
     */
    static requireThese(required: RequireType[]): Parallel;
    /**
     * Starts a new default option (no requirements) Parallel with the specified data and task and resolves a promise when complete.
     * @param {T} data
     * @param {(data: T) => U} task
     * @param env
     * @return {PromiseBase<U>}
     */
    static startNew<T, U>(data: T, task: (data: T) => U, env?: any): PromiseBase<U>;
    /**
     * Asynchronously resolves an array of results processed through the paralleled task function.
     * @param {T[]} data
     * @param {(data: T) => U} task
     * @param env
     * @return {ArrayPromise<U>}
     */
    static map<T, U>(data: T[], task: (data: T) => U, env?: any): ArrayPromise<U>;
    /**
     * Adds prerequisites (required) for the workers.
     * @param {RequireType} required URLs (strings) or Functions (serialized).
     * @return {this}
     */
    require(...required: RequireType[]): this;
    /**
     * Adds prerequisites (required) for the workers.
     * @param {RequireType} required URLs (strings) or Functions (serialized).
     * @return {this}
     */
    requireThese(required: RequireType[]): this;
    /**
     * Schedules the task to be run in the worker pool.
     * @param data
     * @param task
     * @param env
     * @returns {TSDNPromise<U>|TSDNPromise}
     */
    startNew<T, U>(data: T, task: (data: T) => U, env?: any): TSDNPromise<U>;
    /**
     * Runs the task within the local thread/process.
     * Is good for use with testing.
     * @param data
     * @param task
     * @returns {TSDNPromise<U>|TSDNPromise}
     */
    startLocal<T, U>(data: T, task: (data: T) => U): TSDNPromise<U>;
    /**
     * Returns an array of promises that each resolve after their task completes.
     * Provides a potential performance benefit by not waiting for all promises to resolve before proceeding to next step.
     * @param data
     * @param task
     * @param env
     * @returns {PromiseCollection}
     */
    pipe<T, U>(data: T[], task: (data: T) => U, env?: any): PromiseCollection<U>;
    /**
     * Waits for all tasks to resolve and returns a promise with the results.
     * @param data
     * @param task
     * @param env
     * @returns {ArrayPromise}
     */
    map<T, U>(data: T[], task: (data: T) => U, env?: any): ArrayPromise<U>;
    protected _getWorkerSource(task: Function | string, env?: any): string;
    protected _spawnWorker(task: Function | string, env?: any): WorkerLike | undefined;
    private ensureClampedMaxConcurrency;
}
export default Parallel;
