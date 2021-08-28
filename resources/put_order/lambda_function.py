from __future__ import print_function
import boto3, json
import logging
import os
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('TABLENAME'))
stream_name = (os.environ.get('STREAM'))

def lambda_handler(event, context):
    body = json.loads(event['body'])
    item = { 
                'orderid': body['order']['orderid'],
                'accountid': body['order']['accountid'],
                'vendorid': body['order']["vendorid"],
                'orderdate':body['order']["orderdate"],
                'details':{
                    'coffeetype': body['order']['details']['coffeetype'],
                    'coffeesize': body['order']['details']["coffeesize"],
                    'unitprice': body['order']['details']["unitprice"],
                    'quantity': body['order']['details']["quantity"]
                },
            }
    try:
        response = table.put_item(Item = item)
        logger.info("PutItem %s to table %s.",body,table)
        
        k_client = boto3.client('kinesis')
        put_response = k_client.put_record(StreamName=stream_name,Data=json.dumps(body), PartitionKey="1")

        logger.info("PutRecord %s to stream %s.",body,table)
        logger.info(put_response)
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
        logger.exception("Couldn't PutItem %s to table %s",body,table)
        raise