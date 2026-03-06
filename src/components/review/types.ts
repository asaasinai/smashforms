export type AnnotationTool = "none" | "pin" | "highlight" | "draw";

export type AnnotationType = "PIN" | "HIGHLIGHT" | "DRAW";

export type ReviewAnnotation = {
  id: string;
  reviewId: string;
  type: AnnotationType;
  positionX: number;
  positionY: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  elementSelector: string | null;
  comment: string | null;
  aiFollowups: unknown;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type ReviewRecord = {
  id: string;
  targetUrl: string;
  title: string | null;
  devEmail: string | null;
  status: "DRAFT" | "ACTIVE" | "SUBMITTED" | "COMPLETED";
  annotations: ReviewAnnotation[];
};

export type CreateAnnotationInput = {
  type: AnnotationType;
  positionX: number;
  positionY: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  elementSelector?: string;
  comment?: string;
};
