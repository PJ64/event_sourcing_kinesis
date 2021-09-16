## Example
This example demonstrates an event sourcing architecture using Amazon Kinesis. Records are loaded into the kinesis stream using a Lambda function which is integrated with Amazon API Gateway. The Lambda function takes the input from the gateway and writes it to an Amazon Kinesis data stream.

The event triggers 2 additional Lambda functions. The invoice function writes the event object to an Amazon S3 bucket, and the function writes the event data to Amazon DynamoDB. You would use this pattern or something similar, when you require real-time or near real-time data record processing.

There are 2 additional functions, one returns the orders from Amazon DynamoDB, the other returns objects from the Amazon S3 bucket.

![architecture](./images/architecture_4.png "Architecture")

**Jupyter Notebook Scripts**
1.	The first script creates items (orders) and posts them to an Amazon API Gateway which triggers a Lambda function. The Lambda function writes each item to an Amazon Kinesis Stream (event_sourcing_kinesis)

The Kinesis Stream triggers 2 Lambda functions. Both functions pull the records from the stream. The invoice function writes each record as object to an Amazon S3 bucket. The order function writes each record as an item to an Amazon DynamoDB table.

2.	The second script is a json formatter which renders json data into a readable format.

3.	The third script retrieves an item from the event_sourcing_kinesis_order table using the parition key (accountid) and sort key (vendorid)

4.	The fourth script makes a call to Amazon ApiGateway service which in turn triggers a function that generates a pre-signed url for an S3 object.

   
## Setup

1. The following prerequisities are required for this example
  
```bash
npm install -g typescript
npm install -g aws-cdk
```

Install Jupyter Notebook following instructions on this ['site'](https://jupyter.org/install).

2. Since this CDK project uses ['Assests'](https://docs.aws.amazon.com/cdk/latest/guide/assets.html), you might need to run the following command to provision resources the AWS CDK will need to perform the deployment.

```bash 
cdk bootstrap
```

2. Install the dependencies

```bash
npm install
```

3. Execute **cdk synth** to synthesize as AWS CloudFormation template

```bash
cdk synth
```

4. Execute **cdk deploy** to deploy the template and build the stack

```bash
cdk deploy
```
5. Open the Jupyter Notebook in the **jupyter_notebook directory** follow the instructions.

6. Check the dynamoDB table to view the records and S3 bucket to view the invoices

## Cleanup Commands
1. Execute command: **cdk destroy**