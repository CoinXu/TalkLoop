import type { FastifySchema } from "fastify";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";

interface OperationMetadata {
  summary: string;
  security?: Array<Record<string, string[]>>;
}

const tagMetadata = new WeakMap<object, string>();
const operationMetadata = new WeakMap<object, Map<string | symbol, OperationMetadata>>();

export function Tag(name: string): ClassDecorator {
  return (target) => {
    tagMetadata.set(target.prototype, name);
  };
}

export function Operation(summary: string, options: Pick<OperationMetadata, "security"> = {}): MethodDecorator {
  return (target, propertyKey) => {
    const operations = operationMetadata.get(target) ?? new Map<string | symbol, OperationMetadata>();
    operations.set(propertyKey, { summary, ...options });
    operationMetadata.set(target, operations);
  };
}

export interface RouteSchemaDefinition {
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
  response?: Record<number, ZodTypeAny>;
}

export class RouteDocs {
  static schema(instance: object, operationName: string, definition: RouteSchemaDefinition = {}): FastifySchema {
    const prototype = Object.getPrototypeOf(instance);
    const tag = tagMetadata.get(prototype);
    const operation = operationMetadata.get(prototype)?.get(operationName);
    const schema: FastifySchema = {};

    if (tag) {
      schema.tags = [tag];
    }
    if (operation?.summary) {
      schema.summary = operation.summary;
    }
    if (operation?.security) {
      schema.security = operation.security;
    }
    if (definition.params) {
      schema.params = RouteDocs.toJsonSchema(definition.params);
    }
    if (definition.query) {
      schema.querystring = RouteDocs.toJsonSchema(definition.query);
    }
    if (definition.body) {
      schema.body = RouteDocs.toJsonSchema(definition.body);
    }
    if (definition.response) {
      schema.response = Object.fromEntries(
        Object.entries(definition.response).map(([statusCode, responseSchema]) => [
          statusCode,
          RouteDocs.toJsonSchema(responseSchema),
        ]),
      );
    }

    return schema;
  }

  private static toJsonSchema(schema: ZodTypeAny): unknown {
    const jsonSchema = zodToJsonSchema(schema, { target: "jsonSchema7", $refStrategy: "none" });
    if (typeof jsonSchema === "object" && jsonSchema !== null && "$schema" in jsonSchema) {
      const { $schema: _schema, ...rest } = jsonSchema;
      return rest;
    }
    return jsonSchema;
  }
}
