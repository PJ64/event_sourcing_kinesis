import * as cdk from '@aws-cdk/core';
import { LambdaIntegration, RestApi, Cors, CognitoUserPoolsAuthorizer, AuthorizationType } from '@aws-cdk/aws-apigateway';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import { Runtime, Code, Function, Tracing, StartingPosition } from '@aws-cdk/aws-lambda';
import { KinesisEventSource } from '@aws-cdk/aws-lambda-event-sources'
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement } from '@aws-cdk/aws-iam';
import { Stream } from "@aws-cdk/aws-kinesis";
import { Bucket } from '@aws-cdk/aws-s3';

export class EventSourcingKinesisStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Order processing microservice
    const stream = new Stream(this, "KinesisStream", {
      streamName: "event_sourcing_kinesis",
      shardCount: 1
    });

    //Create DynamoDB table
    const processorder_table = new Table(this, "processorder_table",
    {
      tableName: "event_sourcing_kinesis",
      partitionKey: {
        name: 'accountid',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'vendorid',
        type: AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    //Create S3 bucket
    const bucket = new Bucket(this, 's3-bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    //Setup IAM roles and policies
    const role_lambda_stream_put = new Role(this, 'role_lambda_stream_put', {
      roleName: 'event_sourcing_kinesis_stream_put',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_stream_put.addToPolicy(new PolicyStatement({
      resources: [stream.streamArn],
      actions: ["kinesis:PutRecord"],
    }));

    const role_lambda_order_put = new Role(this, 'role_lambda_order_put', {
      roleName: 'event_sourcing_kinesis_order_put',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_order_put.addToPolicy(new PolicyStatement({
      resources: [processorder_table.tableArn, stream.streamArn],
      actions: ["dynamodb:PutItem", "kinesis:GetRecord"],
    }));

    const role_lambda_order_get = new Role(this, 'role_lambda_order_get', {
      roleName: 'event_sourcing_kinesis_order_get',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_order_get.addToPolicy(new PolicyStatement({
      resources: [processorder_table.tableArn],
      actions: ["dynamodb:GetItem"],
    }));

    const role_lambda_invoice_put = new Role(this, 'role_lambda_invoice_put', {
      roleName: 'event_sourcing_kinesis_invoice_get',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_invoice_put.addToPolicy(new PolicyStatement({
      resources: [bucket.bucketArn, `${bucket.bucketArn}/*`, stream.streamArn],
      actions: ["s3:PutObject", "kinesis:GetRecord"],
    }));

    const role_lambda_invoice_get = new Role(this, 'role_lambda_invoice_get', {
      roleName: 'event_sourcing_kinesis_invoice_put',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_invoice_get.addToPolicy(new PolicyStatement({
      resources: [bucket.bucketArn, bucket.bucketArn + "/*"],
      actions: ['s3:GetObject']
    }));

    //Create Lambda functions
    const lambda_stream_put = new Function(this, "lambda_stream_put", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/function_put_stream"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_stream_put",
      tracing: Tracing.ACTIVE,
      role: role_lambda_stream_put,
      environment: {
        'STREAM': stream.streamName,
      }
    });

    //Lambda function - Put Order (ProcessOrder)
    const lambda_order_put = new Function(this, "lambda_order_put", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/function_put_order"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_order_put",
      tracing: Tracing.ACTIVE,
      role: role_lambda_order_put,
      environment: {
        'TABLENAME': processorder_table.tableName,
        'STREAM': stream.streamName,
      }
    });
    lambda_order_put.addEventSource(new KinesisEventSource(stream, {
      batchSize: 1,
      startingPosition: StartingPosition.TRIM_HORIZON
    }))

    const lambda_order_get = new Function(this, "lambda_order_get", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_function.lambda_handler",
      code: Code.fromAsset("resources/function_get_order"),
      functionName: "event_sourcing_kinesis_order_get",
      role: role_lambda_order_get,
      environment: {
        'TABLENAME': processorder_table.tableName,
      }
    });

    //Put Invoice
    const lambda_invoice_put = new Function(this, "lambda_invoice_put", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/function_put_invoice"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_invoice_put",
      tracing: Tracing.ACTIVE,
      role: role_lambda_invoice_put,
      environment: {
        'BUCKETNAME': bucket.bucketName,
        'STREAM': stream.streamName,
      }
    });
    lambda_invoice_put.addEventSource(new KinesisEventSource(stream, {
      batchSize: 100,
      startingPosition: StartingPosition.TRIM_HORIZON
    }))

    const lambda_invoice_get = new Function(this, "lambda_invoice_get", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/function_get_invoice"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_invoice_get",
      tracing: Tracing.ACTIVE,
      role: role_lambda_invoice_get,
      environment: {
        'BUCKETNAME': bucket.bucketName,
      }
    });

    //REST Api with integrated  Lambda function
    var api = new RestApi(this, "OrderApi", {
      restApiName: "event_sourcing_kinesis",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS
      }
    });

    var lambda_stream_put_integration = new LambdaIntegration(lambda_stream_put, {
      requestTemplates: {
        ["application/json"]: "{ \"statusCode\": \"200\" }"
      }
    });

    var lambda_get_order_integration = new LambdaIntegration(lambda_order_get);
    var lambda_get_invoice_integration = new LambdaIntegration(lambda_invoice_get);

    var api_order_resource = api.root.addResource("order");
    api_order_resource.addMethod("POST", lambda_stream_put_integration);
    api_order_resource.addMethod("GET", lambda_get_order_integration);

    var api_invoice_resource = api.root.addResource("invoice");
    api_invoice_resource.addMethod("GET", lambda_get_invoice_integration);
  }
}
