/*!
 * @author electricessence / https://github.com/electricessence/
 * @license MIT
 * Originally based upon Parallel.js: https://github.com/adambom/parallel.js/blob/master/lib/parallel.js
 */

import ObjectPool from '@tsdotnet/object-pool';
import { ArrayPromise, PromiseBase, PromiseCollection, TSDNPromise } from '@tsdotnet/promises';
import { type WorkerLike, deferImmediate, environment, Worker as WorkerN } from '@tsdotnet/threading';

const isNodeJS: boolean = environment.isNodeJS;
/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/ban-types */

declare const navigator: any;
declare const __dirname: string;

//noinspection JSUnusedAssignment
const
	MAX_WORKERS: number = 16,
	VOID0: undefined = void 0,
	URL = typeof self !== 'undefined'
		? (self.URL ? self.URL : self.webkitURL)
		: null,
	_supports = isNodeJS || !!self.Worker; // node always supports parallel

export interface ParallelOptions {
	/**
	 * This is the path to the file eval.js.  This is required when running in node, and required for some browsers (IE 10) in order to work around cross-domain restrictions for web workers.  Defaults to the same location as parallel.js in node environments, and null in the browser.
	 **/
	evalPath?: string | undefined;

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

//noinspection JSUnusedAssignment
const defaults: ParallelOptions = {
	evalPath: isNodeJS ? __dirname + '/eval.js' : VOID0,
	maxConcurrency: isNodeJS
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		? require('os').cpus().length
		: (navigator.hardwareConcurrency || 4),
	allowSynchronous: true,
	env: {},
	envNamespace: 'env'
};

type Lookup<T> = { [key: string]: T };

function extend<TFrom extends Lookup<any>, TTo extends Lookup<any>>(
	from: TFrom,
	to?: TTo): TTo extends undefined ? TFrom : TFrom & TTo {
	if (!to) to = {} as any;
	for (const key of Object.keys(from)) {
		if (to![key] === VOID0) (to as any)[key] = from[key];
	}
	return to as any;
}

function interact(
	w: WorkerLike,
	onMessage: (msg: { data: any }) => void,
	onError: (e: any) => void,
	message?: any): void {
	if (onMessage) w.onmessage = onMessage;
	if (onError) w.onerror = onError;
	if (message !== VOID0) w.postMessage(message);
}

class WorkerPromise<T>
	extends TSDNPromise<T> {
	constructor(worker: WorkerLike, data: any) {
		super((resolve, reject) => {
			interact(
				worker,
				(response: { data: any }) => {
					resolve(response.data);
				},
				(e: any) => {
					reject(e);
				},
				data);
		}, true);
	}
}

/**
 * A URL to a global script to into the worker or a function to serialize.
 */
export type RequireType = string | Function | { name?: string; fn: Function };

namespace workers {

	/*
	 * Note:
	 * Currently there is nothing preventing excessive numbers of workers from being generated.
	 * Eventually there will be a master pool count which will regulate these workers.
	 */

	function getPool(key: string): ObjectPool<WorkerLike> {
		let pool = workerPools[key];
		if (!pool) {
			workerPools[key] = pool = new ObjectPool<WorkerLike>(undefined, undefined, 8);
		}
		return pool;
	}

	const workerPools: Lookup<ObjectPool<WorkerLike>> = {};

	export function recycle(w: WorkerLike | null | undefined): null { // always returns null.
		if (w) {
			w.onerror = null;
			w.onmessage = null;
			const k = (w as any).__key;
			if (k) {
				getPool(k).give(w);
			}
			else {
				deferImmediate(() => w.terminate());
			}
		}
		return null;
	}

	export function tryGet(key: string): WorkerLike | undefined {
		return getPool(key).tryTake();
	}

	export function getNew(key: string, url: string): WorkerLike {
		const worker: any = new WorkerN(url);
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
}


export class Parallel {
	readonly options: ParallelOptions;
	protected readonly _requiredScripts: string[];
	protected readonly _requiredFunctions: { name?: string; fn: Function }[];

	constructor(options?: ParallelOptions) {
		this.options = extend(defaults, options);
		this._requiredScripts = [];
		this._requiredFunctions = [];

		this.ensureClampedMaxConcurrency();
	}

	/**
	 * Returns true if paralleling is supported.
	 * @return {boolean}
	 */
	static get isSupported(): boolean { return _supports; }

	/**
	 * Creates a Parallel with the specified max concurrency.
	 * @param {number} max
	 * @return {Parallel}
	 */
	static maxConcurrency(max: number): Parallel {
		return new Parallel({ maxConcurrency: max });
	}

	/**
	 * Returns a Parallel with the specified options.
	 * @param {ParallelOptions} options
	 * @return {Parallel}
	 */
	static options(options?: ParallelOptions): Parallel {
		return new Parallel(options);
	}

	/**
	 * Returns a parallel with the specified prerequisite requirements.
	 * @param {RequireType} required
	 * @return {Parallel}
	 */
	static require(...required: RequireType[]): Parallel {
		return (new Parallel()).requireThese(required);
	}

	/**
	 * Returns a parallel with the specified prerequisite requirements.
	 * @param {RequireType} required
	 * @return {Parallel}
	 */
	static requireThese(required: RequireType[]): Parallel {
		return (new Parallel()).requireThese(required);
	}

	/**
	 * Starts a new default option (no requirements) Parallel with the specified data and task and resolves a promise when complete.
	 * @param {T} data
	 * @param {(data: T) => U} task
	 * @param env
	 * @return {PromiseBase<U>}
	 */
	static startNew<T, U>(data: T, task: (data: T) => U, env?: unknown): PromiseBase<U> {
		return (new Parallel()).startNew(data, task, env);
	}

	/**
	 * Asynchronously resolves an array of results processed through the paralleled task function.
	 * @param {T[]} data
	 * @param {(data: T) => U} task
	 * @param env
	 * @return {ArrayPromise<U>}
	 */
	static map<T, U>(data: T[], task: (data: T) => U, env?: unknown): ArrayPromise<U> {
		return (new Parallel()).map(data, task, env);
	}

	/**
	 * Adds prerequisites (required) for the workers.
	 * @param {RequireType} required URLs (strings) or Functions (serialized).
	 * @return {this}
	 */
	require(...required: RequireType[]): this {
		return this.requireThese(required);
	}

	/**
	 * Adds prerequisites (required) for the workers.
	 * @param {RequireType} required URLs (strings) or Functions (serialized).
	 * @return {this}
	 */
	requireThese(required: RequireType[]): this {
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
	startNew<T, U>(data: T, task: (data: T) => U, env?: unknown): TSDNPromise<U> {
		const _ = this;
		const maxConcurrency = this.ensureClampedMaxConcurrency();

		const worker = maxConcurrency
			? _._spawnWorker(task, extend(_.options.env, env as any || {}))
			: null;
		if (worker) {
			return new WorkerPromise<U>(worker, data)
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
	startLocal<T, U>(data: T, task: (data: T) => U): TSDNPromise<U> {
		return new TSDNPromise<U>(
			(resolve, reject) => {
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
	pipe<T, U>(data: T[], task: (data: T) => U, env?: unknown): PromiseCollection<U> {

		// The resultant promise collection will make an internal copy...
		let result: TSDNPromise<U>[] | undefined;

		if (data && data.length) {
			const len = data.length;
			const taskString = task.toString();
			const maxConcurrency = this.ensureClampedMaxConcurrency();
			let error: any;
			let i = 0;
			for (let w = 0; !error && i < Math.min(len, maxConcurrency); w++) {
				let worker: WorkerLike | null | undefined = maxConcurrency
					? this._spawnWorker(taskString, env)
					: null;

				if (!worker) {
					if (!this.options.allowSynchronous)
						throw new Error(maxConcurrency
							? 'Workers do not exist and synchronous operation not allowed!'
							: '\'maxConcurrency\' set to 0 but \'allowSynchronous\' is false.');

					// Concurrency doesn't matter in a single thread... Just queue it all up.
					return TSDNPromise.map(data, task);
				}

				if (!result) {
					// There is a small risk that the consumer could call .resolve() which would result in a double resolution.
					// But it's important to minimize the number of objects created.
					result = data.map(() => new TSDNPromise<U>());
				}

				const next = () => {
					if (error) {
						worker = workers.recycle(worker);
					}

					if (worker) {
						if (i < len) {
							//noinspection JSReferencingMutableVariableFromClosure
							const ii = i++, p = result![ii]!;
							const wp = new WorkerPromise<U>(worker, data[ii]);
							//noinspection JSIgnoredPromiseFromCall
							wp.thenSynchronous(
								r => {
									//noinspection JSIgnoredPromiseFromCall
									p.resolve(r);
									next();
								},
								e => {
									if (!error) {
										error = e;
										//noinspection JSIgnoredPromiseFromCall
										p.reject(e);
										worker = workers.recycle(worker);
									}
								})
								.finallyThis(() =>
									wp.dispose());
						}
						else {
							worker = workers.recycle(worker);
						}
					}
				};
				next();
			}

		}

		return new PromiseCollection<U>(result);
	}

	/**
	 * Waits for all tasks to resolve and returns a promise with the results.
	 * @param data
	 * @param task
	 * @param env
	 * @returns {ArrayPromise}
	 */
	map<T, U>(data: T[], task: (data: T) => U, env?: unknown): ArrayPromise<U> {
		if (!data || !data.length)
			return ArrayPromise.fulfilled<U>([]);

		// Would return the same result, but has extra overhead.
		// return this.pipe(data,task).all();

		data = data.slice(); // Never use the original.
		return new ArrayPromise<U>((resolve, reject) => {
			const result: U[] = [], len = data.length;
			result.length = len;

			const taskString = task.toString();
			const maxConcurrency = this.ensureClampedMaxConcurrency();
			let error: any;
			let i = 0, resolved = 0;
			for (let w = 0; !error && i < Math.min(len, maxConcurrency); w++) {
				let worker: WorkerLike | null | undefined = this._spawnWorker(taskString, env);

				if (!worker) {
					if (!this.options.allowSynchronous)
						throw new Error('Workers do not exist and synchronous operation not allowed!');

					// Concurrency doesn't matter in a single thread... Just queue it all up.
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
							const wp = new WorkerPromise<U>(worker, data[ii]);
							//noinspection JSIgnoredPromiseFromCall
							wp.thenSynchronous(
								r => {
									result[ii] = r;
									next();
								},
								e => {
									if (!error) {
										error = e;
										reject(e);
										worker = workers.recycle(worker);
									}
								})
								.thenThis(() => {
									resolved++;
									if (resolved > len) throw Error('Resolved count exceeds data length.');
									if (resolved === len) resolve(result);
								})
								.finallyThis(() =>
									wp.dispose());
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

	protected _getWorkerSource(task: Function | string, env?: unknown): string {
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

		return preStr + (
			isNodeJS
				? `process.on("message", function(e) {global.${ns} = ${env};process.send(JSON.stringify((${task.toString()})(JSON.parse(e).data)))})`
				: `self.onmessage = function(e) {var global = {}; global.${ns} = ${env};self.postMessage((${task.toString()})(e.data))}`
		);
	}

	protected _spawnWorker(task: Function | string, env?: unknown): WorkerLike | undefined {
		const src = this._getWorkerSource(task, env);

		if (WorkerN === VOID0) return VOID0;
		let worker = workers.tryGet(src);
		if (worker) return worker;

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
			worker = workers.getNew(src, evalPath!);
			worker.postMessage(src);
		}
		else if (URL) {
			const blob = new Blob([src], { type: 'text/javascript' });
			const url = URL.createObjectURL(blob);

			worker = workers.getNew(src, url);
		}

		return worker;
	}

	private ensureClampedMaxConcurrency(): number {
		let { maxConcurrency } = this.options;
		if (maxConcurrency && maxConcurrency > MAX_WORKERS) {
			this.options.maxConcurrency = maxConcurrency = MAX_WORKERS;
			console.warn(`More than ${MAX_WORKERS} workers can reach worker limits and cause unexpected results.  maxConcurrency reduced to ${MAX_WORKERS}.`);
		}
		return (maxConcurrency || maxConcurrency === 0) ? maxConcurrency : MAX_WORKERS;
	}
}


export default Parallel;
