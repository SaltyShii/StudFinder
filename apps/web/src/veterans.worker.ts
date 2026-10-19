import { computeVeterans, type VeteranProgress } from './veterans.job';
import { serveJob } from './jobRunner';

serveJob<Parameters<typeof computeVeterans>[0], ReturnType<typeof computeVeterans>, VeteranProgress>((job, onProgress) => computeVeterans(job, (done, total) => onProgress([done, total])));
