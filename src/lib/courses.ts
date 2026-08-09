import { readFile } from "fs/promises";
import path from "path";
import type { CoursesConfig } from "./course-math";

export * from "./course-math";

const COURSES_FILE = path.join(process.cwd(), "data", "courses.json");

export async function loadCoursesConfig(): Promise<CoursesConfig> {
  const raw = await readFile(COURSES_FILE, "utf-8");
  return JSON.parse(raw) as CoursesConfig;
}
