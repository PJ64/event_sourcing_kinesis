import * as cdk from '@aws-cdk/core';
import { AttributeType, Table, BillingMode } from '@aws-cdk/aws-dynamodb';
import { Runtime, Code, Function, Tracing, StartingPosition, LayerVersion,LambdaInsightsVersion } from '@aws-cdk/aws-lambda';
import { KinesisEventSource } from '@aws-cdk/aws-lambda-event-sources'
import { Role, ServicePrincipal, ManagedPolicy, PolicyStatement } from '@aws-cdk/aws-iam';
import { Stream } from "@aws-cdk/aws-kinesis";
import { LambdaIntegration, RestApi, Cors } from '@aws-cdk/aws-apigateway';

export class EventSourcingKinesisStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Kinesis stream
    const stream = new Stream(this, "KinesisStream", {
      streamName: "event_sourcing_kinesis",
      shardCount: 1
    });

    //DynamoDB table
    const processorder_table_1 = new Table(this, "processorder_table_1",
      {
        tableName: "event_sourcing_kinesis_1",
        partitionKey: {
          name: 'accountid',
          type: AttributeType.STRING
        },
        sortKey: {
          name: 'orderdate',
          type: AttributeType.STRING
        },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });

    const processorder_table_2 = new Table(this, "processorder_table_2",
      {
        tableName: "event_sourcing_kinesis_2",
        partitionKey: {
          name: 'accountid',
          type: AttributeType.STRING
        },
        sortKey: {
          name: 'orderdate',
          type: AttributeType.STRING
        },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      });

    //IAM Roles and policies
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

    const role_lambda_item_put_1 = new Role(this, 'role_lambda_item_put_1', {
      roleName: 'event_sourcing_kinesis_item_put_1',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_item_put_1.addToPolicy(new PolicyStatement({
      resources: [processorder_table_1.tableArn, stream.streamArn],
      actions: ["dynamodb:PutItem", "kinesis:GetRecord"],
    }));

    const role_lambda_item_put_2 = new Role(this, 'role_lambda_item_put_2', {
      roleName: 'event_sourcing_kinesis_item_put_2',
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    role_lambda_item_put_2.addToPolicy(new PolicyStatement({
      resources: [processorder_table_2.tableArn, stream.streamArn],
      actions: ["dynamodb:PutItem", "kinesis:GetRecord"],
    }));

    //Lambda layer
    const embeded_metricsLayer = new LayerVersion(this, 'embeded_metricsLayer', {
      layerVersionName: 'observability',
      compatibleRuntimes: [
        Runtime.PYTHON_3_8
      ],
      code: Code.fromAsset('resources/lambda_layer'),
      description: 'xray_sdk_embeded_metrics',
    });

    //Lambda Functions
    const lambda_stream_put = new Function(this, "lambda_stream_put", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/function_stream_put"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_stream_put",
      tracing: Tracing.ACTIVE,
      role: role_lambda_stream_put,
      environment: {
        'STREAM': stream.streamName,
      },
      layers: [embeded_metricsLayer],
      insightsVersion: LambdaInsightsVersion.VERSION_1_0_98_0
    });

    const lambda_object_put_item_1 = new Function(this, "lambda_object_put_item_1", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/function_item_put_1"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_item_put_1",
      tracing: Tracing.ACTIVE,
      role: role_lambda_item_put_1,
      environment: {
        'TABLENAME': processorder_table_1.tableName,
        'STREAM': stream.streamName,
      },
      layers: [embeded_metricsLayer],
      insightsVersion: LambdaInsightsVersion.VERSION_1_0_98_0
    });
    lambda_object_put_item_1.addEventSource(new KinesisEventSource(stream, {
      batchSize: 100,
      startingPosition: StartingPosition.TRIM_HORIZON,
      maxBatchingWindow: cdk.Duration.seconds(30)
    }))

    const lambda_object_put_item_2 = new Function(this, "lambda_object_put_item_2", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromAsset("resources/function_item_put_2"),
      handler: "lambda_function.lambda_handler",
      functionName: "event_sourcing_kinesis_item_put_2",
      tracing: Tracing.ACTIVE,
      role: role_lambda_item_put_2,
      environment: {
        'TABLENAME': processorder_table_2.tableName,
        'STREAM': stream.streamName,
      },
      layers: [embeded_metricsLayer],
      insightsVersion: LambdaInsightsVersion.VERSION_1_0_98_0
    });
    lambda_object_put_item_2.addEventSource(new KinesisEventSource(stream, {
      batchSize: 10,
      startingPosition: StartingPosition.TRIM_HORIZON,
      maxBatchingWindow: cdk.Duration.seconds(2)
    }))

    //REST Api with integrated  Lambda function
    var api = new RestApi(this, "api", {
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

    var api_order_resource = api.root.addResource("order");
    api_order_resource.addMethod("POST", lambda_stream_put_integration);
  }
}
