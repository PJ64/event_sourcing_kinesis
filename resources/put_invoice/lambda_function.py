from __future__ import print_function
import boto3, json, logging, os
from botocore.exceptions import ClientError

logger = logging.getLogger()
#logger.setLevel(logging.INFO)

s3 = boto3.resource('s3')
bucket = s3.Bucket(os.environ.get('BUCKETNAME'))
stream_name = (os.environ.get('STREAM'))

def lambda_handler(event, context):
    kinesis_client = boto3.client('kinesis')
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
                WriteRecord(record)

def WriteRecord(record):
    data = json.loads(record["Data"])
    orderid = data["order"]["orderid"]  
    message = json.dumps(data)    
    utf_data = message.encode("utf-8")
    path = 'orderid_' + orderid + '.json'

    try:
        bucket.put_object(
            ContentType='application/json',
            Key=path,
            Body=utf_data,
            Metadata={'orderid':orderid}
        )
        logger.info("PutObject to bucket %s.",bucket)    
    except ClientError:
        logger.exception("Couldn't PutObject to bucket %s.",bucket)
        raise