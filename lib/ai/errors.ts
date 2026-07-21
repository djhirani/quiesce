export class ModelOutputRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelOutputRejectedError";
  }
}

export class CitationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CitationValidationError";
  }
}
