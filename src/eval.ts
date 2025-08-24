/*!
 * From: https://github.com/adambom/parallel.js/blob/master/lib/eval.js
 */

// Better environment detection for ES modules and Node.js worker_threads
if (typeof process !== 'undefined' && process.once) {
	// Node.js environment (including worker_threads)
	process.once('message', (code: string) => {
		eval(JSON.parse(code).data);
	});
}
else if (typeof self !== 'undefined' && self.onmessage !== undefined) {
	// Web Worker environment
	self.onmessage = (code: any) => {
		eval(code.data);
	};
}
else {
	// Unknown environment - this is a critical error
	throw new Error('Unable to determine worker environment. Expected either Node.js worker_threads or Web Worker environment.');
}
