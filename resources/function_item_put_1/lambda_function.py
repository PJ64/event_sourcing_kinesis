from __future__ import print_function
import boto3, json, logging, os
from decimal import Decimal
from botocore.exceptions import ClientError

logger = logging.getLogger()
#logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ.get('TABLENAME'))
stream_name = os.environ.get('STREAM')
kinesis_client = boto3.client('kinesis')

def lambda_handler(event, context):
    record = get_record()
    write_record(record)

def get_record():
    response = kinesis_client.describe_stream(StreamName=stream_name)
    shard_id = response['StreamDescription']['Shards'][0]['ShardId']
    shard_iterator = kinesis_client.get_shard_iterator(StreamName=stream_name,
	                                                      ShardId=shard_id,
	                                                      ShardIteratorType="TRIM_HORIZON")
    iterator = shard_iterator['ShardIterator']
    record_response = kinesis_client.get_records(
        ShardIterator=iterator,
        Limit=1)
    while 'NextShardIterator' in record_response:
        # read up to 100 records at a time from the shard number
        record_response = kinesis_client.get_records(
            ShardIterator=record_response['NextShardIterator'],
            Limit=1
        )
        # Print only if we have something
        if(record_response['Records']):
            for record in record_response['Records']:
                return record

def write_record(record):
    data = json.loads(record["Data"])
    print(json.dumps(data))
    try:
        response = table.put_item(
            Item={
                'accountid': data['order']['accountid'],
                'orderdate':data['order']["orderdate"][0],
                'vendorid': data['order']["vendorid"],
                'city':data['order']["city"],
                'details':{
                    'coffeetype': data['order']['details']['coffeetype'],
                    'coffeesize': data['order']['details']["coffeesize"],
                    'unitprice': Decimal(data['order']['details']["unitprice"]),
                    'quantity': data['order']['details']["quantity"]
                },
            })
        logger.info("PutItem %s to table %s.",data,table)                    

    except ClientError:
        logger.exception("Couldn't PutItem %s to table %s",data,table)
        raise