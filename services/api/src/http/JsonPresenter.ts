export class JsonPresenter {
  static toJson<T>(value: T): unknown {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((item) => JsonPresenter.toJson(item));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, JsonPresenter.toJson(nestedValue)]),
      );
    }
    return value;
  }
}
