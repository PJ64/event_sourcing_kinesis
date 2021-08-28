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

    //DynamoDB table - ProcessOrder
    const processorder_table = new Table(this, "table-processorder",
      {
        tableName: "event_sourcing_kinesis_process",
        partitionKey: { name: 'orderid', type: AttributeType.STRING },
        sortKey: { name: 'vendorid', type: AttributeType.STRING },
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });

    //IAM role - ProcessOrder
    const role_lambda_processorder = new Role(this, 'role-lambda-process', {
      roleName: 'event_sourcing_kinesis_process',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_processorder.addToPolicy(new PolicyStatement({
      resources: [processorder_table.tableArn, stream.streamArn],
      actions: ["dynamodb:PutItem", "dynamodb:GetItem", "kinesis:PutRecord"],
    }));

    //Lambda function - ProcessOrder
    const processorder_handler = new Function(this, "lambda-processorder", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/put_order"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_process",
      tracing: Tracing.ACTIVE,
      role: role_lambda_processorder,
      environment: {
        'TABLENAME': processorder_table.tableName,
        'STREAM': stream.streamName,
      }
    });

    const lambda_get_order = new Function(this, "GetLambdaFunction", {
      runtime: Runtime.PYTHON_3_7,
      handler: "lambda_handler.lambda_handler",
      code: Code.fromAsset("resources/get_order"),
      functionName: "get_coffee_order",
      role: role_lambda_processorder,
      environment: {
        'TABLENAME': processorder_table.tableName,
        'STREAM': stream.streamName,
      }
    });

    //REST Api with integrated  Lambda function
    var api = new RestApi(this, "OrderApi", {
      restApiName: "apigw_lambda_dynamodb",
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS
      }
    });

    var lambda_post_integration = new LambdaIntegration(processorder_handler, {
      requestTemplates: {
        ["application/json"]: "{ \"statusCode\": \"200\" }"
      }
    });

    var lambda_get_integration = new LambdaIntegration(lambda_get_order);

    var apiresource = api.root.addResource("order");
    apiresource.addMethod("POST", lambda_post_integration);
    apiresource.addMethod("GET", lambda_get_integration);

    //Microservice Invoice
    //S3 bucket - invoice
    const invoicebucket = new Bucket(this, 's3-bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    //IAM role - Invoice
    const role_lambda_invoiceorder = new Role(this, 'role-lambda-invoice', {
      roleName: 'event_sourcing_kinesis_invoice',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_invoiceorder.addToPolicy(new PolicyStatement({
      resources: [invoicebucket.bucketArn, `${invoicebucket.bucketArn}/*`, stream.streamArn],
      actions: ["s3:PutObject","kinesis:GetRecord"],
    }));

    //Lambda function - Invoice
    const invoice_handler = new Function(this, "lambda-invoiceorder", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/put_invoice"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_invoice",
      tracing: Tracing.ACTIVE,
      role: role_lambda_invoiceorder,
      environment: {
        'BUCKETNAME': invoicebucket.bucketName,
        'STREAM': stream.streamName,
      }
    });

    invoice_handler.addEventSource(new KinesisEventSource(stream, {
      batchSize: 100,
      startingPosition: StartingPosition.TRIM_HORIZON
    }))

    //Microservice Fulfillment
    //DynamoDB table - Fulfillment
    const fulfillment_table = new Table(this, "table-fulfillment",
      {
        tableName: "event_sourcing_kinesis_fulfillment",
        partitionKey: { name: 'orderid', type: AttributeType.STRING },
        sortKey: { name: 'vendorid', type: AttributeType.STRING },
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });

    //IAM role - Fulfillment
    const role_lambda_fulfillment = new Role(this, 'role-lambda-fulfillment', {
      roleName: 'event_sourcing_kinesis_fulfillment',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_fulfillment.addToPolicy(new PolicyStatement({
      resources: [fulfillment_table.tableArn, stream.streamArn],
      actions: ["dynamodb:PutItem","kinesis:GetRecord"],
    }));

    //Lambda function - Fulfillment
    const fulfillment_handler = new Function(this, "lambda-fulfillment", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/put_fulfillment"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_fulfillment",
      tracing: Tracing.ACTIVE,
      role: role_lambda_fulfillment,
      environment: {
        'TABLENAME': fulfillment_table.tableName,
        'STREAM': stream.streamName,
      }
    });

    fulfillment_handler.addEventSource(new KinesisEventSource(stream,{
      batchSize: 100,
      startingPosition: StartingPosition.TRIM_HORIZON
    }));
  }
}
