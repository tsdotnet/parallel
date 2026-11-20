![@tsdotnet/parallel: Spread the work, gather it. Run tasks in parallel workers.](https://cdn.jsdelivr.net/gh/tsdotnet/parallel@master/assets/banner.svg)

[![npm version](https://img.shields.io/npm/v/@tsdotnet/parallel.svg?style=flat-square)](https://www.npmjs.com/package/@tsdotnet/parallel)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/tsdotnet/parallel/blob/master/LICENSE)

Run functions over data in parallel worker threads, in Node.js and the browser, with a synchronous fallback.

## Install

```sh
npm install @tsdotnet/parallel
```

## Usage

```ts
import { Parallel } from '@tsdotnet/parallel';

const squares = Parallel.map([1, 2, 3, 4], n => n * n);
squares.then(values => console.log(values)); // [1, 4, 9, 16]
```

Tasks run in worker threads, so each task function must be self-contained. Pass shared values with `env` and helper code with `require`.

## Use it from

ESM (`import { Parallel } from '@tsdotnet/parallel';`) or CommonJS (`const { Parallel } = require('@tsdotnet/parallel');`). No `<script>` (UMD) build: use it with a bundler or Node.js.

## Docs

[tsdotnet.github.io/parallel](https://tsdotnet.github.io/parallel/)
