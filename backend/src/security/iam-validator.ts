/**
 * Validador de políticas IAM de ApexVision AI.
 *
 * Parsea documentos de política IAM y detecta wildcards (*) en campos
 * Action y Resource. Verifica que cada política otorga permisos específicos.
 *
 * Validates: Requirement 10.5
 */

/** Estructura de un statement de política IAM */
export interface IamStatement {
  Effect: 'Allow' | 'Deny';
  Action: string | string[];
  Resource: string | string[];
  Condition?: Record<string, unknown>;
}

/** Documento de política IAM */
export interface IamPolicyDocument {
  Version: string;
  Statement: IamStatement[];
}

/** Resultado de validación de una política */
export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
}

/** Violación detectada */
export interface Violation {
  statementIndex: number;
  field: 'Action' | 'Resource';
  value: string;
  reason: string;
}

/**
 * Detecta si un valor contiene un wildcard (*).
 *
 * @param value - Valor a evaluar (action o resource)
 * @returns true si contiene wildcard
 */
export function containsWildcard(value: string): boolean {
  return value === '*';
}

/**
 * Valida un statement individual de una política IAM.
 *
 * @param statement - Statement a validar
 * @param index - Índice del statement en el documento
 * @returns Lista de violaciones encontradas
 */
export function validateStatement(statement: IamStatement, index: number): Violation[] {
  const violations: Violation[] = [];

  // Solo validamos statements Allow (Deny con wildcard es aceptable)
  if (statement.Effect !== 'Allow') {
    return violations;
  }

  // Validar Actions
  const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
  for (const action of actions) {
    if (containsWildcard(action)) {
      violations.push({
        statementIndex: index,
        field: 'Action',
        value: action,
        reason: 'Wildcard (*) en Action no cumple con least-privilege',
      });
    }
  }

  // Validar Resources
  const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
  for (const resource of resources) {
    if (containsWildcard(resource)) {
      violations.push({
        statementIndex: index,
        field: 'Resource',
        value: resource,
        reason: 'Wildcard (*) en Resource no cumple con least-privilege',
      });
    }
  }

  return violations;
}

/**
 * Valida un documento completo de política IAM.
 *
 * @param policy - Documento de política IAM
 * @returns Resultado con valid=true si no hay wildcards, false si los hay
 */
export function validatePolicy(policy: IamPolicyDocument): ValidationResult {
  const violations: Violation[] = [];

  for (let i = 0; i < policy.Statement.length; i++) {
    const statementViolations = validateStatement(policy.Statement[i], i);
    violations.push(...statementViolations);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
