"use strict";
/*!
 * From: https://github.com/adambom/parallel.js/blob/master/lib/eval.js
 */
if (typeof process !== 'undefined' && process.once) {
    process.once('message', (code) => {
        eval(JSON.parse(code).data);
    });
}
else if (typeof self !== 'undefined' && self.onmessage !== undefined) {
    self.onmessage = (code) => {
        eval(code.data);
    };
}
else {
    throw new Error('Unable to determine worker environment. Expected either Node.js worker_threads or Web Worker environment.');
}
//# sourceMappingURL=eval.js.map