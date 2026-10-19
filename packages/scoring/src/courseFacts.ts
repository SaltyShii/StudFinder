import courses from '@stud-finder/sim/src/data/course_data.json';
import { CourseHelpers } from '@stud-finder/sim/src/CourseData';
import { surfaceOf } from './ace';

/** What the scoring code needs to know about a CM course. */
export interface CourseFacts {
	distance: number;
	surface: 'turf' | 'dirt';
}

/** The one place scoring reads a course out of the sim. */
export function courseFacts(courseId: number): CourseFacts {
	if (!Object.hasOwn(courses, courseId)) throw new Error(`Unknown course id ${courseId}`);
	const c = CourseHelpers.getCourse(courseId);
	return { distance: c.distance, surface: surfaceOf(c.surface) };
}
