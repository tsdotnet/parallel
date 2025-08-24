import ObjectPool from '@tsdotnet/object-pool';
import { TSDNPromise, PromiseCollection, ArrayPromise } from '@tsdotnet/promises';
import { environment, deferImmediate, Worker } from '@tsdotnet/threading';

/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 * Originally based upon Parallel.js: https://github.com/adambom/parallel.js/blob/master/lib/parallel.js
 */
const isNodeJS = environment.isNodeJS;
const MAX_WORKERS = 16, VOID0 = void 0, URL = typeof self !== 'undefined'
    ? (self.URL ? self.URL : self.webkitURL)
    : null, _supports = isNodeJS || !!self.Worker;
const defaults = {
    evalPath: isNodeJS ? __dirname + '/eval.js' : VOID0,
    maxConcurrency: isNodeJS
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
class WorkerPromise extends TSDNPromise {
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
    function getPool(key) {
        let pool = workerPools[key];
        if (!pool) {
            workerPools[key] = pool = new ObjectPool(undefined, undefined, 8);
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
                deferImmediate(() => w.terminate());
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
        const worker = new Worker(url);
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
    options;
    _requiredScripts;
    _requiredFunctions;
    constructor(options) {
        this.options = extend(defaults, options);
        this._requiredScripts = [];
        this._requiredFunctions = [];
        this.ensureClampedMaxConcurrency();
    }
    static get isSupported() { return _supports; }
    static maxConcurrency(max) {
        return new Parallel({ maxConcurrency: max });
    }
    static options(options) {
        return new Parallel(options);
    }
    static require(...required) {
        return (new Parallel()).requireThese(required);
    }
    static requireThese(required) {
        return (new Parallel()).requireThese(required);
    }
    static startNew(data, task, env) {
        return (new Parallel()).startNew(data, task, env);
    }
    static map(data, task, env) {
        return (new Parallel()).map(data, task, env);
    }
    require(...required) {
        return this.requireThese(required);
    }
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
    startLocal(data, task) {
        return new TSDNPromise((resolve, reject) => {
            try {
                resolve(task(data));
            }
            catch (e) {
                reject(e);
            }
        });
    }
    pipe(data, task, env) {
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
                    return TSDNPromise.map(data, task);
                }
                if (!result) {
                    result = data.map(() => new TSDNPromise());
                }
                const next = () => {
                    if (error) {
                        worker = workers.recycle(worker);
                    }
                    if (worker) {
                        if (i < len) {
                            const ii = i++, p = result[ii];
                            const wp = new WorkerPromise(worker, data[ii]);
                            wp.thenSynchronous(r => {
                                p.resolve(r);
                                next();
                            }, e => {
                                if (!error) {
                                    error = e;
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
        return new PromiseCollection(result);
    }
    map(data, task, env) {
        if (!data || !data.length)
            return ArrayPromise.fulfilled([]);
        data = data.slice();
        return new ArrayPromise((resolve, reject) => {
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
                    resolve(TSDNPromise.map(data, task).all());
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
        if (!isNodeJS && scripts.length) {
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
        return preStr + (isNodeJS
            ? `process.on("message", function(e) {global.${ns} = ${env};process.send(JSON.stringify((${task.toString()})(JSON.parse(e).data)))})`
            : `self.onmessage = function(e) {var global = {}; global.${ns} = ${env};self.postMessage((${task.toString()})(e.data))}`);
    }
    _spawnWorker(task, env) {
        const src = this._getWorkerSource(task, env);
        if (Worker === VOID0)
            return VOID0;
        let worker = workers.tryGet(src);
        if (worker)
            return worker;
        const scripts = this._requiredScripts;
        const evalPath = this.options.evalPath;
        if (!evalPath) {
            if (isNodeJS)
                throw new Error('Can\'t use NodeJS without eval.js!');
            if (scripts.length)
                throw new Error('Can\'t use required scripts without eval.js!');
            if (!URL)
                throw new Error('Can\'t create a blob URL in this browser!');
        }
        if (isNodeJS || scripts.length || !URL) {
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

export { Parallel, Parallel as default };
//# sourceMappingURL=Parallel.js.map
