export interface LessonOccurrence {
  date: Date;
  name: string;
  startTime: string;
}

export interface Series {
  name: string;
  startTime: string;
  dates: Date[];
}

export interface ScanResult {
  occurrences: LessonOccurrence[];
  monthsScanned: number;
}

export interface PreviewSummary {
  lessonCount: number;
  monthsScanned: number;
  subjects: { name: string; count: number }[];
}
