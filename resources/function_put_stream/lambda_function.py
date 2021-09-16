from __future__ import print_function
import boto3, json
import logging
import os
from botocore.exceptions import ClientError

logger = logging.getLogger()

stream_name = (os.environ.get('STREAM'))

def lambda_handler(event, context):
    body = json.loads(event['body'])
    item = {'order':{ 
                'accountid': body['order']['accountid'],
                'vendorid': body['order']["vendorid"],
                'orderdate':body['order']["orderdate"],
                'details':{
                    'coffeetype': body['order']['details']['coffeetype'],
                    'coffeesize': body['order']['details']["coffeesize"],
                    'unitprice': body['order']['details']["unitprice"],
                    'quantity': body['order']['details']["quantity"]
                }
            }
        }
    try:
        k_client = boto3.client('kinesis')
        response = k_client.put_record(StreamName=stream_name,Data=json.dumps(body), PartitionKey="1")
        logger.info("Successfully PutRecord %s into stream.",body)

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
        logger.exception("Failed PutRecord %s into stream.",item)
        raise
