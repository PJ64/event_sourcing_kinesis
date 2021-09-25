## Example
This example demonstrates an event sourcing architecture using Amazon Kinesis. Records are loaded into the kinesis stream using a Lambda function which is integrated with Amazon API Gateway. The Lambda function takes the input from the gateway and writes it to an Amazon Kinesis data stream.

The event triggers 2 additional Lambda functions. The invoice function writes the event object to an Amazon S3 bucket, and the function writes the event data to Amazon DynamoDB. You would use this pattern or something similar, when you require real-time or near real-time data record processing.

There are 2 additional functions, one returns the orders from Amazon DynamoDB, the other returns objects from the Amazon S3 bucket.

![architecture](./images/architecture_4.png "Architecture")
   
## Setup

## Setup
You will need to download and install [Node.js](https://nodejs.org/en/download/) before you can start using the AWS Cloud Development Kit.
This example is developed using the AWS CDK and Typescript, so you will need to install both Typescript and the CDK using the following commands
```
npm install -g typescript
npm install -g aws-cdk@latest
```
Since this CDK project uses ['Assests'](https://docs.aws.amazon.com/cdk/latest/guide/assets.html), you might need to run the following command to provision resources the AWS CDK will need to perform the deployment.

```bash 
cdk bootstrap
```

The testing scripts can be executed using Jupyter Notebook. There are a few methods for installing Jupyter Notebooks. These instructions will help you get to started with [JupyterLab](https://jupyter.org/install) installation. 

You can also install Jupyter Notebooks as part of [Anaconda](https://docs.anaconda.com/anaconda/install/index.html) installation.

To download this example, you will need to install [Git](https://github.com/git-guides/install-git). After installing git follow these [instructions](https://github.com/git-guides/git-clone) to learn how to clone the repository.

After the repository has been cloned set the command prompt path and run the following command to install the project dependencies.


```bash
npm install
```

Execute **cdk synth** to synthesize as AWS CloudFormation template

```bash
cdk synth
```

Execute **cdk deploy** to deploy the template and build the stack

```bash
cdk deploy
```
Open the Jupyter Notebook in the **jupyter_notebook directory** follow the instructions.


 Check the dynamoDB table to view the records and S3 bucket to view the invoices

## Cleanup Commands
1. Execute command: **cdk destroy**