import { computeVeterans, type VeteranJob, type VeteranMessage } from './job';

const w = self as unknown as { postMessage(m: VeteranMessage): void; onmessage: (e: MessageEvent<VeteranJob>) => void };
w.onmessage = (e) => w.postMessage({ result: computeVeterans(e.data, (done, total) => w.postMessage({ progress: [done, total] })) });
