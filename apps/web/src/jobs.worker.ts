import { runJob } from './runJob';
import type { JobProgress, JobRequest } from './jobs';
import { serveJob } from './jobRunner';

serveJob<JobRequest, ReturnType<typeof runJob>, JobProgress>(runJob);
