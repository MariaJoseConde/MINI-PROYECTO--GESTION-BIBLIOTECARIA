import type { NextFunction, Request, Response } from 'express';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array';
  minLength?: number;
  min?: number;
  pattern?: RegExp;
  message?: string;
}

export function validateBody(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const errors: Array<{ field: string; message: string }> = [];

    for (const rule of rules) {
      const value = body[rule.field];
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim().length === 0);

      if (rule.required && missing) {
        errors.push({
          field: rule.field,
          message: rule.message || `El campo "${rule.field}" es obligatorio.`,
        });
        continue;
      }

      if (missing) continue;

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push({
          field: rule.field,
          message: rule.message || `El campo "${rule.field}" debe ser texto.`,
        });
        continue;
      }

      if (rule.type === 'number') {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          errors.push({
            field: rule.field,
            message: rule.message || `El campo "${rule.field}" debe ser numérico.`,
          });
          continue;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push({
            field: rule.field,
            message:
              rule.message || `El campo "${rule.field}" debe ser mayor o igual a ${rule.min}.`,
          });
          continue;
        }
      }

      if (rule.type === 'array' && !Array.isArray(value)) {
        errors.push({
          field: rule.field,
          message: rule.message || `El campo "${rule.field}" debe ser una lista.`,
        });
        continue;
      }

      if (typeof value === 'string') {
        if (rule.minLength !== undefined && value.trim().length < rule.minLength) {
          errors.push({
            field: rule.field,
            message:
              rule.message ||
              `El campo "${rule.field}" requiere al menos ${rule.minLength} caracteres.`,
          });
        }
        if (rule.pattern && !rule.pattern.test(value.trim())) {
          errors.push({
            field: rule.field,
            message: rule.message || `El formato de "${rule.field}" es inválido.`,
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: errors[0].message,
        details: errors,
      });
    }

    return next();
  };
}
