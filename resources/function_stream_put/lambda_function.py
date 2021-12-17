from __future__ import print_function
import boto3, json
import logging
import os
from botocore.exceptions import ClientError

logger = logging.getLogger()

stream_name = (os.environ.get('STREAM'))

def lambda_handler(event, context):
    record = json.loads(event['body'])
    response = put_record(record)
    return response

def put_record(record):
    print(json.dumps(record))
    try:
        k_client = boto3.client('kinesis')
        response = k_client.put_record(StreamName=stream_name,Data=json.dumps(record), PartitionKey="1")
        print(response)
        logger.info("Successfully PutRecord %s into stream.",record)

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            'body': json.dumps(response)
        }

    except ClientError:
        logger.exception("Failed PutRecord %s into stream.",record)
        raise
