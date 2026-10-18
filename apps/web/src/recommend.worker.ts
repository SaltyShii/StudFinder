import { compute, type Job } from './job';

self.onmessage = (e: MessageEvent<Job>) => (self as unknown as Worker).postMessage(compute(e.data));
