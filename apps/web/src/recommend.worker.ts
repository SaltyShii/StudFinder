import { computeRecommend } from './recommend.job';
import { serveJob } from './jobRunner';

serveJob(computeRecommend);
