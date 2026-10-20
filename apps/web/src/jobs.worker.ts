import { runJob } from './runJob';
import type { VeteranProgress, JobRequest } from './jobs';
import { serveJob } from './jobRunner';

serveJob<JobRequest, ReturnType<typeof runJob>, VeteranProgress>(runJob);
