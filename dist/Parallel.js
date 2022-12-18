"use strict";
/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 * Originally based upon Parallel.js: https://github.com/adambom/parallel.js/blob/master/lib/parallel.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parallel = void 0;
const tslib_1 = require("tslib");
const object_pool_1 = tslib_1.__importDefault(require("@tsdotnet/object-pool"));
const promises_1 = require("@tsdotnet/promises");
const deferImmediate_1 = tslib_1.__importDefault(require("@tsdotnet/threading/dist/deferImmediate"));
const environment_1 = require("@tsdotnet/threading/dist/environment");
const Worker_1 = tslib_1.__importDefault(require("@tsdotnet/threading/dist/Worker"));
//noinspection JSUnusedAssignment
const MAX_WORKERS = 16, VOID0 = void 0, URL = typeof self !== 'undefined'
    ? (self.URL ? self.URL : self.webkitURL)
    : null, _supports = environment_1.isNodeJS || !!self.Worker; // node always supports parallel
//noinspection JSUnusedAssignment
const defaults = {
    evalPath: environment_1.isNodeJS ? __dirname + '/eval.js' : VOID0,
    maxConcurrency: environment_1.isNodeJS
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        ? require('os').cpus().length
        : (navigator.hardwareConcurrency || 4),
    allowSynchronous: true,
    env: {},
    envNamespace: 'env'
};
function extend(from, to) {
    if (!to)
        to = {};
    for (const key of Object.keys(from)) {
        if (to[key] === VOID0)
            to[key] = from[key];
    }
    return to;
}
function interact(w, onMessage, onError, message) {
    if (onMessage)
        w.onmessage = onMessage;
    if (onError)
        w.onerror = onError;
    if (message !== VOID0)
        w.postMessage(message);
}
class WorkerPromise extends promises_1.TSDNPromise {
    constructor(worker, data) {
        super((resolve, reject) => {
            interact(worker, (response) => {
                resolve(response.data);
            }, (e) => {
                reject(e);
            }, data);
        }, true);
    }
}
var workers;
(function (workers) {
    /*
     * Note:
     * Currently there is nothing preventing excessive numbers of workers from being generated.
     * Eventually there will be a master pool count which will regulate these workers.
     */
    function getPool(key) {
        let pool = workerPools[key];
        if (!pool) {
            workerPools[key] = pool = new object_pool_1.default(undefined, undefined, 8);
        }
        return pool;
    }
    const workerPools = {};
    function recycle(w) {
        if (w) {
            w.onerror = null;
            w.onmessage = null;
            const k = w.__key;
            if (k) {
                getPool(k).give(w);
            }
            else {
                (0, deferImmediate_1.default)(() => w.terminate());
            }
        }
        return null;
    }
    workers.recycle = recycle;
    function tryGet(key) {
        return getPool(key).tryTake();
    }
    workers.tryGet = tryGet;
    function getNew(key, url) {
        const worker = new Worker_1.default(url);
        worker.__key = key;
        if (!worker.dispose) {
            worker.dispose = () => {
                worker.onmessage = null;
                worker.onerror = null;
                worker.dispose = null;
                worker.terminate();
            };
        }
        return worker;
    }
    workers.getNew = getNew;
})(workers || (workers = {}));
class Parallel {
    constructor(options) {
        this.options = extend(defaults, options);
        this._requiredScripts = [];
        this._requiredFunctions = [];
        this.ensureClampedMaxConcurrency();
    }
    /**
     * Returns true if paralleling is supported.
     * @return {boolean}
     */
    static get isSupported() { return _supports; }
    /**
     * Creates a Parallel with the specified max concurrency.
     * @param {number} max
     * @return {Parallel}
     */
    static maxConcurrency(max) {
        return new Parallel({ maxConcurrency: max });
    }
    /**
     * Returns a Parallel with the specified options.
     * @param {ParallelOptions} options
     * @return {Parallel}
     */
    static options(options) {
        return new Parallel(options);
    }
    /**
     * Returns a parallel with the specified prerequisite requirements.
     * @param {RequireType} required
     * @return {Parallel}
     */
    static require(...required) {
        return (new Parallel()).requireThese(required);
    }
    /**
     * Returns a parallel with the specified prerequisite requirements.
     * @param {RequireType} required
     * @return {Parallel}
     */
    static requireThese(required) {
        return (new Parallel()).requireThese(required);
    }
    /**
     * Starts a new default option (no requirements) Parallel with the specified data and task and resolves a promise when complete.
     * @param {T} data
     * @param {(data: T) => U} task
     * @param env
     * @return {PromiseBase<U>}
     */
    static startNew(data, task, env) {
        return (new Parallel()).startNew(data, task, env);
    }
    /**
     * Asynchronously resolves an array of results processed through the paralleled task function.
     * @param {T[]} data
     * @param {(data: T) => U} task
     * @param env
     * @return {ArrayPromise<U>}
     */
    static map(data, task, env) {
        return (new Parallel()).map(data, task, env);
    }
    /**
     * Adds prerequisites (required) for the workers.
     * @param {RequireType} required URLs (strings) or Functions (serialized).
     * @return {this}
     */
    require(...required) {
        return this.requireThese(required);
    }
    /**
     * Adds prerequisites (required) for the workers.
     * @param {RequireType} required URLs (strings) or Functions (serialized).
     * @return {this}
     */
    requireThese(required) {
        for (const a of required) {
            switch (typeof a) {
                case 'string':
                    this._requiredScripts.push(a);
                    break;
                case 'function':
                    this._requiredFunctions.push({ fn: a });
                    break;
                case 'object':
                    this._requiredFunctions.push(a);
                    break;
                default:
                    throw new TypeError('Invalid type.');
            }
        }
        return this;
    }
    /**
     * Schedules the task to be run in the worker pool.
     * @param data
     * @param task
     * @param env
     * @returns {TSDNPromise<U>|TSDNPromise}
     */
    startNew(data, task, env) {
        const _ = this;
        const maxConcurrency = this.ensureClampedMaxConcurrency();
        const worker = maxConcurrency
            ? _._spawnWorker(task, extend(_.options.env, env || {}))
            : null;
        if (worker) {
            return new WorkerPromise(worker, data)
                .finallyThis(() => workers.recycle(worker));
        }
        if (_.options.allowSynchronous)
            return this.startLocal(data, task);
        throw new Error(maxConcurrency
            ? 'Workers do not exist and synchronous operation not allowed!'
            : '\'maxConcurrency\' set to 0 but \'allowSynchronous\' is false.');
    }
    /**
     * Runs the task within the local thread/process.
     * Is good for use with testing.
     * @param data
     * @param task
     * @returns {TSDNPromise<U>|TSDNPromise}
     */
    startLocal(data, task) {
        return new promises_1.TSDNPromise((resolve, reject) => {
            try {
                resolve(task(data));
            }
            catch (e) {
                reject(e);
            }
        });
    }
    /**
     * Returns an array of promises that each resolve after their task completes.
     * Provides a potential performance benefit by not waiting for all promises to resolve before proceeding to next step.
     * @param data
     * @param task
     * @param env
     * @returns {PromiseCollection}
     */
    pipe(data, task, env) {
        // The resultant promise collection will make an internal copy...
        let result;
        if (data && data.length) {
            const len = data.length;
            const taskString = task.toString();
            const maxConcurrency = this.ensureClampedMaxConcurrency();
            let error;
            let i = 0;
            for (let w = 0; !error && i < Math.min(len, maxConcurrency); w++) {
                let worker = maxConcurrency
                    ? this._spawnWorker(taskString, env)
                    : null;
                if (!worker) {
                    if (!this.options.allowSynchronous)
                        throw new Error(maxConcurrency
                            ? 'Workers do not exist and synchronous operation not allowed!'
                            : '\'maxConcurrency\' set to 0 but \'allowSynchronous\' is false.');
                    // Concurrency doesn't matter in a single thread... Just queue it all up.
                    return promises_1.TSDNPromise.map(data, task);
                }
                if (!result) {
                    // There is a small risk that the consumer could call .resolve() which would result in a double resolution.
                    // But it's important to minimize the number of objects created.
                    result = data.map(() => new promises_1.TSDNPromise());
                }
                const next = () => {
                    if (error) {
                        worker = workers.recycle(worker);
                    }
                    if (worker) {
                        if (i < len) {
                            //noinspection JSReferencingMutableVariableFromClosure
                            const ii = i++, p = result[ii];
                            const wp = new WorkerPromise(worker, data[ii]);
                            //noinspection JSIgnoredPromiseFromCall
                            wp.thenSynchronous(r => {
                                //noinspection JSIgnoredPromiseFromCall
                                p.resolve(r);
                                next();
                            }, e => {
                                if (!error) {
                                    error = e;
                                    //noinspection JSIgnoredPromiseFromCall
                                    p.reject(e);
                                    worker = workers.recycle(worker);
                                }
                            })
                                .finallyThis(() => wp.dispose());
                        }
                        else {
                            worker = workers.recycle(worker);
                        }
                    }
                };
                next();
            }
        }
        return new promises_1.PromiseCollection(result);
    }
    /**
     * Waits for all tasks to resolve and returns a promise with the results.
     * @param data
     * @param task
     * @param env
     * @returns {ArrayPromise}
     */
    map(data, task, env) {
        if (!data || !data.length)
            return promises_1.ArrayPromise.fulfilled([]);
        // Would return the same result, but has extra overhead.
        // return this.pipe(data,task).all();
        data = data.slice(); // Never use the original.
        return new promises_1.ArrayPromise((resolve, reject) => {
            const result = [], len = data.length;
            result.length = len;
            const taskString = task.toString();
            const maxConcurrency = this.ensureClampedMaxConcurrency();
            let error;
            let i = 0, resolved = 0;
            for (let w = 0; !error && i < Math.min(len, maxConcurrency); w++) {
                let worker = this._spawnWorker(taskString, env);
                if (!worker) {
                    if (!this.options.allowSynchronous)
                        throw new Error('Workers do not exist and synchronous operation not allowed!');
                    // Concurrency doesn't matter in a single thread... Just queue it all up.
                    resolve(promises_1.TSDNPromise.map(data, task).all());
                    return;
                }
                const next = () => {
                    if (error) {
                        worker = workers.recycle(worker);
                    }
                    if (worker) {
                        if (i < len) {
                            const ii = i++;
                            const wp = new WorkerPromise(worker, data[ii]);
                            //noinspection JSIgnoredPromiseFromCall
                            wp.thenSynchronous(r => {
                                result[ii] = r;
                                next();
                            }, e => {
                                if (!error) {
                                    error = e;
                                    reject(e);
                                    worker = workers.recycle(worker);
                                }
                            })
                                .thenThis(() => {
                                resolved++;
                                if (resolved > len)
                                    throw Error('Resolved count exceeds data length.');
                                if (resolved === len)
                                    resolve(result);
                            })
                                .finallyThis(() => wp.dispose());
                        }
                        else {
                            worker = workers.recycle(worker);
                        }
                    }
                };
                next();
            }
        });
    }
    _getWorkerSource(task, env) {
        const scripts = this._requiredScripts, functions = this._requiredFunctions;
        let preStr = '';
        if (!environment_1.isNodeJS && scripts.length) {
            preStr += 'importScripts("' + scripts.join('","') + '");\r\n';
        }
        for (const { name, fn } of functions) {
            const source = fn.toString();
            preStr += name
                ? `var ${name} = ${source};`
                : source;
        }
        env = JSON.stringify(env || {});
        const ns = this.options.envNamespace;
        return preStr + (environment_1.isNodeJS
            ? `process.on("message", function(e) {global.${ns} = ${env};process.send(JSON.stringify((${task.toString()})(JSON.parse(e).data)))})`
            : `self.onmessage = function(e) {var global = {}; global.${ns} = ${env};self.postMessage((${task.toString()})(e.data))}`);
    }
    _spawnWorker(task, env) {
        const src = this._getWorkerSource(task, env);
        if (Worker_1.default === VOID0)
            return VOID0;
        let worker = workers.tryGet(src);
        if (worker)
            return worker;
        const scripts = this._requiredScripts;
        const evalPath = this.options.evalPath;
        if (!evalPath) {
            if (environment_1.isNodeJS)
                throw new Error('Can\'t use NodeJS without eval.js!');
            if (scripts.length)
                throw new Error('Can\'t use required scripts without eval.js!');
            if (!URL)
                throw new Error('Can\'t create a blob URL in this browser!');
        }
        if (environment_1.isNodeJS || scripts.length || !URL) {
            worker = workers.getNew(src, evalPath);
            worker.postMessage(src);
        }
        else if (URL) {
            const blob = new Blob([src], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            worker = workers.getNew(src, url);
        }
        return worker;
    }
    ensureClampedMaxConcurrency() {
        let { maxConcurrency } = this.options;
        if (maxConcurrency && maxConcurrency > MAX_WORKERS) {
            this.options.maxConcurrency = maxConcurrency = MAX_WORKERS;
            console.warn(`More than ${MAX_WORKERS} workers can reach worker limits and cause unexpected results.  maxConcurrency reduced to ${MAX_WORKERS}.`);
        }
        return (maxConcurrency || maxConcurrency === 0) ? maxConcurrency : MAX_WORKERS;
    }
}
exports.Parallel = Parallel;
exports.default = Parallel;
//# sourceMappingURL=Parallel.js.map