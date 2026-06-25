import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  readonly prefix: string;
}

/**
 * Stack de autenticación y autorización.
 * Configura Amazon Cognito User Pool con MFA, grupos de roles
 * y Identity Pool para credenciales AWS temporales.
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.IUserPool;
  public readonly userPoolClient: cognito.IUserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // User Pool con políticas de seguridad estrictas
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${props.prefix}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      customAttributes: {
        rol: new cognito.StringAttribute({ mutable: true }),
        pilotosAsignados: new cognito.StringAttribute({ mutable: true }),
      },
    });

    this.userPool = userPool;

    // User Pool Client
    this.userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: `${props.prefix}-web-client`,
      authFlows: {
        userSrp: true,
        custom: true,
      },
      accessTokenValidity: cdk.Duration.minutes(15),
      refreshTokenValidity: cdk.Duration.hours(24),
      idTokenValidity: cdk.Duration.minutes(15),
      preventUserExistenceErrors: true,
      generateSecret: false,
    });

    // Grupos de Cognito (roles)
    const groups = ['admin', 'ingeniero_pista', 'analista', 'viewer'];
    groups.forEach((groupName) => {
      new cognito.CfnUserPoolGroup(this, `Group-${groupName}`, {
        userPoolId: userPool.userPoolId,
        groupName,
        description: `Grupo de rol: ${groupName}`,
      });
    });

    // Identity Pool para credenciales AWS temporales
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `${props.prefix}-identity-pool`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });

    // Rol autenticado base (mínimo privilegio)
    const authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Rol base para usuarios autenticados de ApexVision',
    });

    // Adjuntar rol al Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'RoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      exportName: `${props.prefix}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${props.prefix}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      exportName: `${props.prefix}-identity-pool-id`,
    });
  }
}
